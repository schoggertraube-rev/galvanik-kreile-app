"""S54o C10: pinned normative validators over actual TEST writer originals.

No rendering, database writes or financial calculations happen here. A green
Mustang process alone is insufficient: its PDF and XML reports both must pass.
"""
from pathlib import Path
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import urllib.request
import xml.etree.ElementTree as ET
import zipfile

TOOLS = {
    'kosit.jar': ('https://repo.maven.apache.org/maven2/org/kosit/validator/1.6.3/validator-1.6.3-standalone.jar', '799e64befca97d4080e03608c80b85dd5a5ecc5f4ae4f35d1116ec2855b9a7c9'),
    'mustang.jar': ('https://github.com/ZUGFeRD/mustangproject/releases/download/core-2.26.0/Mustang-CLI-2.26.0.jar', '42d7868cb68264874a7b8cab4c3587b03b23ccc7cd72373da917f66758bb9736'),
    'kosit-config.zip': ('https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip', '2530cd107c414511c5d0462ec10f886910395abfca820db82e83d70bf01221a8'),
}
NS = {'r': 'http://www.xoev.de/de/validator/varl/1', 's': 'http://www.xoev.de/de/validator/framework/1/scenarios', 'v': 'http://purl.oclc.org/dsdl/svrl'}

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()

def download_tools(directory):
    directory.mkdir(parents=True, exist_ok=True)
    for name, (url, sha) in TOOLS.items():
        file = directory / name
        if not file.exists():
            with urllib.request.urlopen(url, timeout=60) as response, file.open('wb') as target:
                shutil.copyfileobj(response, target)
        require(digest(file) == sha, 'VALIDATOR_PIN_MISMATCH: ' + name)
    config = directory / 'kosit-config'
    # Always reconstruct the small configuration from the verified archive;
    # an old or altered extracted rule must never be trusted as a cache hit.
    config.mkdir(exist_ok=True)
    with zipfile.ZipFile(directory / 'kosit-config.zip') as archive:
        for item in archive.infolist():
            target = (config / item.filename).resolve()
            require(target.is_relative_to(config.resolve()), 'VALIDATOR_ARCHIVE_PATH_INVALID')
        archive.extractall(config)
    require((config / 'scenarios.xml').is_file(), 'VALIDATOR_SCENARIOS_MISSING')
    return config

def validate(java, tools, config, evidence, output, name):
    stem = 'kreile-s54o-' + name
    pdf, xml = evidence / (stem + '.pdf'), evidence / (stem + '.xml')
    require(pdf.is_file() and xml.is_file(), 'ACTUAL_HYBRID_PAIR_MISSING: ' + name)
    metadata_name = {'a1': 'v3-actual', 'a1-vat': 'font-roundtrip', 'a5': 'cancel-glyph-rejection'}.get(name, name)
    metadata = json.loads((evidence / ('kreile-s54o-' + metadata_name + '.json')).read_text(encoding='utf-8'))
    if name == 'a5':
        metadata = metadata['correctedCancellation']
        expected_sha = metadata['cancellationPdfSha256']
    else:
        expected_sha = metadata['pdfSha256']
    require(digest(pdf) == expected_sha, 'ACTUAL_ORIGINAL_HASH_MISMATCH: ' + name)
    target = output / name
    target.mkdir(parents=True, exist_ok=True)
    commands = {
        'extract': [java, '-Dfile.encoding=UTF-8', '-jar', str(tools / 'mustang.jar'), '--action', 'extract', '--source', str(pdf), '--out', str(target / 'extracted.xml'), '--disable-file-logging'],
        'kosit': [java, '-Dfile.encoding=UTF-8', '-jar', str(tools / 'kosit.jar'), '-s', str(config / 'scenarios.xml'), '-r', str(config), '-o', str(target), '-h', str(xml)],
        'mustang': [java, '-Dfile.encoding=UTF-8', '-jar', str(tools / 'mustang.jar'), '--action', 'validate', '--source', str(pdf), '--disable-file-logging'],
    }
    exits = {}
    empty = target / 'stdin-empty.txt'
    empty.write_bytes(b'')
    for validator, command in commands.items():
        with empty.open('rb') as stdin, (target / (validator + '.log')).open('wb') as log:
            exits[validator] = subprocess.run(command, stdin=stdin, stdout=log, stderr=subprocess.STDOUT, timeout=100, check=False).returncode
    require(exits['extract'] == 0 and (target / 'extracted.xml').read_bytes() == xml.read_bytes(), 'PDF_XML_PAIR_MISMATCH: ' + name)
    report = ET.parse(target / (stem + '-report.xml')).getroot()
    scenario = report.find('r:scenarioMatched/s:scenario/s:name', NS)
    failed = report.findall('.//v:failed-assert', NS)
    require(exits['kosit'] == 0 and report.get('valid') == 'true' and scenario is not None and scenario.text == 'EN16931 (CII)' and report.find('r:assessment/r:accept', NS) is not None and not failed,
            'KOSIT_FAILED: ' + name + ' ' + json.dumps([{'id': item.get('id'), 'text': ''.join(item.itertext())} for item in failed], ensure_ascii=False))
    raw = (target / 'mustang.log').read_bytes().decode('utf-8', errors='replace')
    pdf_part, xml_part = re.search(r'<pdf>(.*?)</pdf>', raw, re.S), re.search(r'<xml>(.*?)</xml>', raw, re.S)
    require(exits['mustang'] == 0 and pdf_part is not None and 'isCompliant=true' in pdf_part.group(1) and '<summary status="valid"' in pdf_part.group(1), 'PDF_A_RULES_FAILED: ' + name)
    require(xml_part is not None and '<summary status="valid"' in xml_part.group(1), 'MUSTANG_XML_FAILED: ' + name)
    proof = {'case': name, 'actualInvoiceId': metadata['invoiceId'], 'pdfSha256': expected_sha, 'xmlSha256': digest(xml), 'kositEn16931Cii': True, 'mustangXml': True, 'pdfaIndividualRules': True, 'exits': exits, 'pins': TOOLS}
    (target / 'proof.json').write_text(json.dumps(proof, indent=2) + '\n', encoding='utf-8')
    print(name + ': KoSIT / PDF-A individual rules / Mustang XML green', flush=True)
    return proof

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--evidence', required=True, type=Path)
    parser.add_argument('--tools', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--java', default='java')
    args = parser.parse_args()
    config = download_tools(args.tools)
    args.output.mkdir(parents=True, exist_ok=True)
    proofs = [validate(args.java, args.tools, config, args.evidence, args.output, name) for name in ['a1', 'a1-vat', 'a2', 'a4', 'a5', 'a15-corrected', 'a19-partial', 'a19-rounded-full', 'a19-rounded-partial', 'a19-rounded-partial-cancel']]
    (args.output / 'proof.json').write_text(json.dumps(proofs, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    main()
