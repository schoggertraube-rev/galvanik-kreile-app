// Start the real prepared listener under Playwright's unchanged readiness limit.
import {connect} from 'node:net';
if(process.env.KREILE_OFFLINE_SMOKE!=='1'||!process.env.KREILE_SMOKE_CONTROL_PIPE)throw Error('OFFLINE_SMOKE_PREPARATION_REQUIRED');
const socket=connect(process.env.KREILE_SMOKE_CONTROL_PIPE);
socket.setEncoding('utf8');socket.once('connect',()=>socket.write('start'));
socket.once('error',error=>{console.error(error);process.exit(1);});
socket.once('data',message=>{if(message!=='started')throw Error('OFFLINE_SMOKE_START_FAILED');socket.end();setInterval(()=>{},60_000);});
