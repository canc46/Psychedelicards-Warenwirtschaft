// CardCorpus and TCGdex edition index. Pokémon name translations from PokéAPI.
function bindEditionSearch(onSelect) {
  const clean = text => String(text).normalize('NFKC').toLowerCase().replace(/é/g,'e')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const terms = text => clean(text).replace(/\b(?:stamped|stamps?|stempel|gestempelt)\b/g,'stempel');
  const input = $('cardQuery'), box = $('editionBox'), picker = $('editionChoices');
  let pending, timer, revision = 0, matches = [], shown = 0;
  function prepare({sets,cards,names,variantLabels=[],promoSets=[]}) {
    const aliases = new Map();
    for (const group of names) for (const name of group) aliases.set(clean(name),group);
    const promo = new Set(promoSets);
    return cards.flatMap(([sid,id,name,number,copies=[]])=>{
      const [lang,setId,set,code] = sets[sid];
      const gb = setId==='japanese/miscellaneous-promos' && id==='venusaur-4cfff8';
      const title = gb ? 'Pokémon Card GB Official Guidebook (1999)' : set;
      const translated = clean(name).split(' ').flatMap(word=>aliases.get(word)||[]);
      const full = aliases.get(clean(name)) || [];
      const keys = terms([name,...translated,...full,set,code,number,
        code+number.split('/')[0],promo.has(sid)?'Promo':'', gb?'GB Promo Game Boy Gameboy Guidebook Bisaflor Venusaur フシギバナ No 003 1999':''].join(' '));
      const base={id,setId,lang,name:gb?'Bisaflor':name,set:title,number,keys,gb};
      return [base,...copies.map(([label,product,reverse])=>{
        const variant=variantLabels[label];
        const extra=/stamp|stempel/i.test(variant)?' promo stempel':'';
        const together=/together|gemeinsam/i.test(variant)?' gemeinsam pokemon pokemon together':'';
        return {...base,variant,product,reverse,keys:keys+' '+terms(variant+extra+together)};
      })];
    });
  }
  function next() {
    const end=Math.min(shown+100,matches.length);
    for (;shown<end;shown++) {
      const r=matches[shown];
      picker.add(new Option([r.name,r.set,r.number||'ohne Nummer',r.variant,languages[r.lang]].filter(Boolean).join(' · '),String(shown)));
    }
    $('editionMore').hidden=shown===matches.length;
  }
  function start() {
    clearTimeout(timer);
    const current=++revision, words=terms(input.value).split(' ').filter(Boolean);
    box.hidden=true;
    if (!words.length || words.join('').length<2) return;
    timer=setTimeout(async()=>{
      try {
        pending ||= fetch('./edition-index.json?v=prints1').then(r=>{if(!r.ok)throw Error();return r.json()})
          .then(prepare).catch(e=>{pending=null;throw e});
        const entries=await pending;
        if (current!==revision) return;
        matches=entries.filter(r=>words.every(w=>r.keys.includes(w)));
        const lang=$('cardLanguage').value;
        matches.sort((a,b)=>Number(b.gb)-Number(a.gb)||Number(b.lang===lang)-Number(a.lang===lang));
        picker.replaceChildren(new Option('Ausgabe auswählen …',''));
        shown=0;next();
        $('editionCount').textContent=matches.length+' weitere Katalogtreffer';
        box.hidden=!matches.length;
      } catch {
        if (current!==revision) return;
        picker.replaceChildren();$('editionMore').hidden=true;box.hidden=false;
        $('editionCount').textContent='Erweiterter Katalog konnte nicht geladen werden. Bitte erneut suchen.';
      }
    },180);
  }
  input.addEventListener('input',start);
  $('editionMore').onclick=next;
  picker.onchange=()=>{if(picker.value!=='') onSelect(matches[Number(picker.value)]);};
  return ()=>{clearTimeout(timer);revision++;box.hidden=true;};
}
