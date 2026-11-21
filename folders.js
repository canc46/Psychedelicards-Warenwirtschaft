const setKey = name => String(name || '').trim().normalize('NFKC').toLowerCase().replace(/\s+/g,' ');
const setSort = new Intl.Collator('de', {numeric:true,sensitivity:'base'});
let catalogRows = [], catalogPending, folderLanguage = '';
function setImage(row) {
  const image = row?.[3];
  if (!image) return '';
  if (/^[a-f0-9]{32}$/.test(image)) return 'https://img.cardcorpus.com/s1/240/' + image + '.avif';
  return image.startsWith('https://assets.tcgdex.net/') ? image + '.png' : '';
}
function logo(row) {
  const url = setImage(row);
  return url ? '<img class="setLogo" loading="lazy" alt="" src="'+esc(url)+'" onerror="this.hidden=true">' : '';
}
async function loadCatalog() {
  if (!catalogPending) catalogPending = fetch('./set-catalog.json').then(r=>{
    if (!r.ok) throw Error();
    return r.json();
  }).then(rows=>{catalogRows=rows;renderStock();}).catch(e=>{catalogPending=null;throw e;});
  return catalogPending;
}
function groupCards(cards, render, query) {
  const previouslyOpen = new Set([...document.querySelectorAll('#items details[open]')].map(el=>el.dataset.folder));
  const folders = new Map();
  for (const c of cards) {
    const name = String(c.setName || '').trim() || 'Ohne Set';
    const lang = c.language || '';
    if (folderLanguage && folderLanguage!==lang) continue;
    const key = lang+'|'+setKey(name);
    if (!folders.has(key)) folders.set(key,{name,lang,key,cards:[]});
    folders.get(key).cards.push(c);
  }
  return [...folders.values()].sort((a,b)=>setSort.compare(a.name,b.name)||setSort.compare(a.lang,b.lang)).map(f=>{
    const row=catalogRows.find(r=>r[0]===f.lang && setKey(r[1])===setKey(f.name));
    const sorted=f.cards.sort((a,b)=>setSort.compare(a.name,b.name)||setSort.compare(a.cardNumber,b.cardNumber));
    return '<details class="setFolder" data-folder="'+esc(f.key)+'" '+(query||previouslyOpen.has(f.key)?'open':'')+'><summary>'+logo(row)+esc(f.name)+' · '+esc(languages[f.lang]||'Sprache offen')+' ('+sorted.length+')</summary>'+sorted.map(render).join('')+'</details>';
  }).join('');
}
function gradingFields(prefix, data={}) {
  return '<label for="'+prefix+'Provider">Grading-Anbieter</label><select id="'+prefix+'Provider">'+['PSA','CGC','Beckett'].map(x=>'<option '+(x===data.provider?'selected':'')+'>'+x+'</option>').join('')+'</select>'+
  '<label for="'+prefix+'Cert">Zertifikatsnummer</label><input id="'+prefix+'Cert" inputmode="numeric" value="'+esc(data.cert)+'">'+
  '<label for="'+prefix+'Grade">Note laut Label</label><input id="'+prefix+'Grade" placeholder="z. B. 9,5 oder Pristine 10" value="'+esc(data.grade)+'"><p id="'+prefix+'Links"></p>';
}
function gradingValue(prefix) {
  return {provider:$(prefix+'Provider').value,cert:$(prefix+'Cert').value.trim(),grade:$(prefix+'Grade').value.trim()};
}
function purchaseGrading() {return $('condition').value==='Graded'?gradingValue('g'):null;}
function gradingLinks(g) {
  if (g?.provider==='PSA') {
    const cert=String(g.cert || '').trim();
    const valid=/^\d+$/.test(cert);
    const url='https://www.psacard.com/cert'+(valid?'/'+cert+'/psa#:~:text=PSA%20Population':'');
    const label=valid?'PSA Population für Zertifikat '+cert:'PSA-Zertifikat nachschlagen';
    return '<a href="'+url+'" target="_blank" rel="noopener">'+label+' ↗</a>';
  }
  if (!g?.cert) return '';
  const cert=encodeURIComponent(g.cert);
  const url={CGC:'https://www.cgccards.com/certlookup/'+cert+'/',Beckett:'https://www.beckett.com/grading/card-lookup?flag=1&item_type=BGS&item_id='+cert}[g.provider];
  if (!url) return '';
  return '<a href="'+esc(url)+'" target="_blank" rel="noopener">Zertifikat '+esc(g.cert)+' ↗</a>';
}
function bindGrading(box,prefix,condition,data) {
  box.innerHTML=gradingFields(prefix,data);
  const update=()=>{box.hidden=condition.value.trim().toLowerCase()!=='graded';$(prefix+'Links').innerHTML=gradingLinks(gradingValue(prefix));};
  box.oninput=update; condition.oninput=update;update();
}
function resetGrading() {
  if ($('condition').value==='Graded') $('condition').value='NM';
  $('gCert').value='';$('gGrade').value='';$('condition').dispatchEvent(new Event('input'));
}
function initFolders() {
  bindGrading($('gradeFields'),'g',$('condition'));
  const picker=$('catalogSet'), list=$('catalogCards');
  function options() {
    const q=setKey($('catalogQuery').value);
    picker.replaceChildren(new Option('Set auswählen …',''));
    const rows=catalogRows.filter(r=>r[0]===$('catalogLanguage').value && setKey(r[1]+' '+r[4]).includes(q)).sort((a,b)=>setSort.compare(a[1],b[1]));
    rows.forEach(r=>picker.add(new Option(r[1]+(r[4]?' · '+r[4]:''),String(catalogRows.indexOf(r)))));
    list.replaceChildren();$('catalogPreview').replaceChildren();
    $('catalogStatus').textContent=rows.length+' Sets';
  }
  $('catalogBrowse').ontoggle=async()=>{
    if (!$('catalogBrowse').open) return;
    try {await loadCatalog();options();} catch {$('catalogStatus').textContent='Katalog konnte nicht geladen werden. Zum Wiederholen erneut öffnen.';}
  };
  $('catalogQuery').oninput=options;$('catalogLanguage').onchange=options;
  picker.onchange=async()=>{
    const value=picker.value;list.replaceChildren();$('catalogPreview').replaceChildren();
    if (!value) return;
    const row=catalogRows[Number(value)], [lang,set,id]=row;
    $('catalogPreview').innerHTML=logo(row);
    $('catalogStatus').textContent='Karten werden geladen …';
    const tcg=id.startsWith('t/');
    const url=tcg?'https://api.tcgdex.net/v2/'+lang+'/sets/'+id.slice(2):'https://raw.githubusercontent.com/cardcorpus/pokemon-card-dataset/c4f0b415d1dd3d4fbaadb8c32a0a591126746ed6/v1/sets/'+id+'.json';
    try {
      const r=await fetch(url);if(!r.ok)throw Error();const data=await r.json();
      if(value!==picker.value)return;
      const cards=data.cards.map(c=>({name:c.name,number:tcg?[c.localId,data.cardCount?.official].filter(Boolean).join('/'):c.number?.printed||c.number?.numerator||''})).sort((a,b)=>setSort.compare(a.name,b.name)||setSort.compare(a.number,b.number));
      $('catalogStatus').textContent=cards.length+' Katalogkarten';
      if (!cards.length)return;
      const select=document.createElement('select');select.setAttribute('aria-label','Katalogkarte');select.add(new Option('Karte auswählen …',''));
      cards.forEach((c,i)=>select.add(new Option([c.name,c.number].filter(Boolean).join(' · '),String(i))));
      list.append(select);select.onchange=()=>{
        if(!select.value)return;
        const card=cards[Number(select.value)];tab('new');$('kind').value='single';$('kind').dispatchEvent(new Event('change'));kindChanged();
        $('cardLanguage').value=lang;$('name').value=card.name;$('name').dataset.lookupCode=row[4]+' '+card.number;
        $('setName').value=set;$('cardNumber').value=card.number;$('market').value='';$('purchasePrice').value='';$('purchasePrice').focus();
      };
    }catch{if(value===picker.value)$('catalogStatus').textContent='Set nicht erreichbar. Bitte erneut auswählen.';}
  };
}
