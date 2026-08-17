import { readFile } from 'node:fs/promises'
import { fireEvent, render, screen } from '@testing-library/react'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { GlobalSearch } from '../GlobalSearch'

const sourcePath = 'src/components/layout/GlobalSearch.tsx'

function walk(node: ts.Node, visit: (current: ts.Node) => void) {
  visit(node)
  node.forEachChild((child) => walk(child, visit))
}

describe('W2C GlobalSearch fail-closed', () => {
  it('renders the real FoundationUnavailable contract only while open', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<GlobalSearch onOpenChange={onOpenChange} open={false} />)

    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(<GlobalSearch onOpenChange={onOpenChange} open />)

    expect(screen.getByRole('dialog', { name: 'Globale Suche ist nicht verfügbar' })).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByText('NOT_AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('Operative Daten sind noch nicht verfügbar')).toBeInTheDocument()
    expect(screen.getByText('Für diesen Bereich ist noch keine kanonische, quellgestützte operative Datenbasis verfügbar.')).toBeInTheDocument()
  })

  it('closes with its explicit control and Escape, and toggles with Ctrl/Cmd+K', () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<GlobalSearch onOpenChange={onOpenChange} open />)

    fireEvent.click(screen.getByRole('button', { name: 'Globale Suche schließen' }))
    const escape = new KeyboardEvent('keydown', { cancelable: true, key: 'Escape' })
    const ctrlK = new KeyboardEvent('keydown', { cancelable: true, ctrlKey: true, key: 'k' })
    const cmdK = new KeyboardEvent('keydown', { cancelable: true, key: 'k', metaKey: true })
    document.dispatchEvent(escape)
    document.dispatchEvent(ctrlK)
    document.dispatchEvent(cmdK)

    expect(onOpenChange).toHaveBeenNthCalledWith(1, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(3, false)
    expect(onOpenChange).toHaveBeenNthCalledWith(4, false)
    expect(escape.defaultPrevented).toBe(true)
    expect(ctrlK.defaultPrevented).toBe(true)
    expect(cmdK.defaultPrevented).toBe(true)

    rerender(<GlobalSearch onOpenChange={onOpenChange} open={false} />)
    const closedCtrlK = new KeyboardEvent('keydown', { cancelable: true, ctrlKey: true, key: 'k' })
    document.dispatchEvent(closedCtrlK)
    expect(closedCtrlK.defaultPrevented).toBe(true)
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
  })

  it('closes on its backdrop but not from a dialog interaction', () => {
    const onOpenChange = vi.fn()
    render(<GlobalSearch onOpenChange={onOpenChange} open />)

    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.mouseDown(dialog.parentElement as HTMLElement)
    expect(onOpenChange).toHaveBeenCalledOnce()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps the client module to the two safe runtime imports and no unsafe syntax', async () => {
    const source = await readFile(sourcePath, 'utf8')
    const program = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const imports = program.statements.filter(ts.isImportDeclaration)

    expect(imports).toHaveLength(2)
    expect(imports.map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)).toEqual([
      'react',
      '@/components/foundation/FoundationUnavailable',
    ])
    expect(imports[0].importClause?.namedBindings && ts.isNamedImports(imports[0].importClause.namedBindings)
      ? imports[0].importClause.namedBindings.elements.map((element) => element.name.text)
      : []).toEqual(['useEffect'])
    expect(imports[1].importClause?.namedBindings && ts.isNamedImports(imports[1].importClause.namedBindings)
      ? imports[1].importClause.namedBindings.elements.map((element) => element.name.text)
      : []).toEqual(['FoundationUnavailable'])

    const forbiddenIdentifiers = new Set([
      'Link',
      'useRouter',
      'useState',
      'useRef',
      'globalSearch',
      'useGlobalSearch',
      'findActions',
      'buildFallbackSuggestion',
      'SEARCH_ACTIONS',
      'addRecentSearch',
      'useOrderModal',
      'useCustomerOverlay',
      'useErfassung',
      'motion',
      'fetch',
      'setTimeout',
      'clearTimeout',
    ])
    const encounteredForbiddenIdentifiers: string[] = []
    const calledIdentifiers: string[] = []
    const foundationUnavailableElements: ts.JsxSelfClosingElement[] = []

    walk(program, (node) => {
      if (ts.isIdentifier(node) && forbiddenIdentifiers.has(node.text)) {
        encounteredForbiddenIdentifiers.push(node.text)
      }
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        calledIdentifiers.push(node.expression.text)
      }
      if (ts.isJsxSelfClosingElement(node) && ts.isIdentifier(node.tagName) && node.tagName.text === 'FoundationUnavailable') {
        foundationUnavailableElements.push(node)
      }
    })

    expect(encounteredForbiddenIdentifiers).toEqual([])
    expect(calledIdentifiers).not.toEqual(expect.arrayContaining(['fetch', 'setTimeout', 'clearTimeout', 'globalSearch', 'useGlobalSearch']))
    expect(foundationUnavailableElements).toHaveLength(1)
    const transpiled = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2017 },
      fileName: sourcePath,
      reportDiagnostics: true,
    })
    expect(transpiled.diagnostics ?? []).toEqual([])
  })
})
