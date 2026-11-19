import legacy from '@/ui/generated/legacyStyle.json';

/** Build-time public stylesheet. Its bytes are the existing sheet, not a second design. */
export const dynamic='force-static';
export function GET(){
 return new Response(legacy.css,{headers:{'Content-Type':'text/css; charset=utf-8'}});
}
