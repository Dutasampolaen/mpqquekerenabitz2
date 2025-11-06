export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body style={{fontFamily:'system-ui',background:'#0b1220',color:'#e5e7eb',margin:0}}>
        <div style={{padding:16,borderBottom:'1px solid #1f2937',position:'sticky',top:0,background:'#0a1222'}}>MPK — Dashboard (Starter)</div>
        <div style={{padding:16}}>{children}</div>
      </body>
    </html>
  );
}
