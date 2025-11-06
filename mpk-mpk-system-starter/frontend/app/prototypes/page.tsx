export default function Prototypes() {
  const list = [
    'mpk-proker-mvp.html',
    'mpk-dashboard-bulkadd.html',
    'mpk-bulk-names.html',
    'mpk-bulk-names-bidang.html',
    'mpk-master-members.html',
  ];
  return (
    <div>
      <h2>Prototypes (static)</h2>
      <p>File ada di repo <code>/prototypes</code>. Buka langsung dari file system atau host secara statis.</p>
      <ul>
        {list.map(x => <li key={x}><a href={`http://localhost:3000/static/${x}`} style={{color:'#86efac'}}>{x}</a></li>)}
      </ul>
      <p style={{marginTop:16}}>Untuk hosting statis cepat, jalankan server static (contoh: <code>npx serve prototypes</code>)</p>
    </div>
  );
}
