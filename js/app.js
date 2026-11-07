(() => {
  'use strict';
  const D = window.DADOS;
  const $ = (id) => document.getElementById(id);
  const VALOR = { 1: 119, 2: 179, 3: 239 };
  const KIT = { 1: 'Kit Inicio', 2: 'Kit Recetas', 3: 'Kit Completo' };
  const CHAVE_LOCAL = 'gelatina.clave';
  const guardar = {
    ler(k) { try { return localStorage.getItem(k); } catch { return null; } },
    pôr(k, v) { try { localStorage.setItem(k, v); } catch { /* navegador sem armazenamento: só não lembra */ } },
    tirar(k) { try { localStorage.removeItem(k); } catch { /* idem */ } },
  };
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const normal = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

  let acesso = null; // { nivel, valor, archivos }

  async function abrirCofre(clave) {
    const texto = normal(clave);
    if (!texto) return null;
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(texto), 'PBKDF2', false, ['deriveKey']);
    const chave = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(D.kdf.sal), iterations: D.kdf.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    for (const n of D.niveles) {
      const buf = b64(n.cofre);
      try {
        const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, chave, buf.slice(12));
        return JSON.parse(new TextDecoder().decode(plano));
      } catch { /* essa senha não é deste nível */ }
    }
    return null;
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  function cartao(m, i) {
    const li = document.createElement('li');
    const aberto = m.gratis || (acesso && acesso.archivos[m.id]);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'livro' + (aberto ? '' : ' fechado');
    b.style.setProperty('--i', i);
    const capa = document.createElement('span');
    capa.className = 'livro-capa';
    const img = document.createElement('img');
    img.src = `img/capas/${m.id}.webp`;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 333; img.height = 472;
    capa.append(img);
    if (!aberto) {
      const selo = document.createElement('span');
      selo.className = 'selo-candado';
      selo.innerHTML = '<svg width="14" height="14" aria-hidden="true"><use href="#i-candado"/></svg>';
      selo.append(KIT[m.nivel].replace('Kit ', ''));
      capa.append(selo);
    }
    const nome = document.createElement('span');
    nome.className = 'livro-nome';
    nome.textContent = m.titulo;
    const info = document.createElement('span');
    info.className = 'livro-info';
    info.textContent = aberto ? plural(m.paginas, 'página', 'páginas') : `Viene en el ${KIT[m.nivel]}`;
    b.append(capa, nome, info);
    b.addEventListener('click', () => (aberto ? abrirLeitor(m) : fechado(m)));
    li.append(b);
    return li;
  }

  function estante(titulo, texto, itens, inicio) {
    const s = document.createElement('section');
    s.className = 'estante';
    const cab = document.createElement('div');
    cab.className = 'estante-cabeca';
    const h = document.createElement('h2');
    h.textContent = titulo;
    cab.append(h);
    if (texto) { const p = document.createElement('p'); p.textContent = texto; cab.append(p); }
    const ul = document.createElement('ul');
    ul.className = 'livros';
    itens.forEach((m, i) => ul.append(cartao(m, inicio + i)));
    s.append(cab, ul);
    return s;
  }

  /* ---------- vídeos: miniatura leve; o player do YouTube só carrega no toque ---------- */
  const ORDEM_FILEIRA = ['Técnicas', 'Gelatinas sin azúcar', 'Gelatinas cremosas', 'Gelatinas de fruta', 'Gelatinas de colores', 'Gelatinas con proteína', 'Reto de 30 días', 'Aguas y comidas ligeras', 'Chía'];
  const NOME_FILEIRA = { 'Técnicas': 'Lo básico: preparar, cuajar y desmoldar', 'Reto de 30 días': 'Gelatinas del reto de 30 días', 'Chía': 'Con chía' };
  const qtdVideos = (n) => (D.videosPorNivel && D.videosPorNivel[n]) || 0;
  const minutos = (m) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);

  function cartaoVideo(v) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'video';
    b.setAttribute('aria-label', `Ver video: ${v.tema}`);
    const tela = document.createElement('span');
    tela.className = 'video-tela';
    const img = document.createElement('img');
    img.src = `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 320; img.height = 180;
    const play = document.createElement('span');
    play.className = 'video-play';
    play.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
    const dur = document.createElement('span');
    dur.className = 'video-dur';
    dur.textContent = minutos(v.min);
    tela.append(img, play, dur);
    const nome = document.createElement('span');
    nome.className = 'video-nome';
    nome.textContent = v.tema;
    b.append(tela, nome);
    b.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&playsinline=1&modestbranding=1`;
      f.title = v.tema;
      f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      f.allowFullscreen = true;
      f.className = 'video-player';
      const caixa = document.createElement('div');
      caixa.className = 'video tocando';
      const t = document.createElement('span');
      t.className = 'video-tela';
      t.append(f);
      caixa.append(t, nome);
      b.replaceWith(caixa);
    });
    li.append(b);
    return li;
  }

  function estanteVideos(lista) {
    if (!lista || !lista.length) return null;
    const s = document.createElement('section');
    s.className = 'estante estante-videos';
    const cab = document.createElement('div');
    cab.className = 'estante-cabeca';
    const h = document.createElement('h2');
    h.textContent = `Tus videos (${lista.length})`;
    const p = document.createElement('p');
    p.textContent = 'Recetas paso a paso para ver mientras cocinas. Toca uno y se reproduce aquí mismo.';
    cab.append(h, p);
    s.append(cab);
    const grupos = ORDEM_FILEIRA.map((f) => [f, lista.filter((v) => v.fileira === f)]).filter(([, l]) => l.length);
    for (const [f, l] of grupos) {
      const h3 = document.createElement('h3');
      h3.className = 'fileira-nome';
      h3.textContent = NOME_FILEIRA[f] || f;
      const ul = document.createElement('ul');
      ul.className = 'videos';
      l.forEach((v) => ul.append(cartaoVideo(v)));
      s.append(h3, ul);
    }
    return s;
  }

  function desenhar(animar) {
    const caixa = $('estantes');
    caixa.replaceChildren();
    caixa.classList.toggle('abriu', Boolean(animar));
    const nivel = acesso ? acesso.nivel : 0;
    const de = (n) => D.catalogo.filter((m) => m.nivel === n);
    const meus = D.catalogo.filter((m) => m.nivel <= nivel);

    $('formClave').hidden = Boolean(acesso);
    $('saludo').hidden = !acesso;
    $('salirFila').hidden = !acesso;
    $('portadaLinea').textContent = acesso ? 'Toca una portada para empezar a leer.' : 'Tu material prometido y tus kits.';

    if (acesso) {
      $('saludoTitulo').textContent = `Tu ${KIT[nivel]}: ${plural(meus.length, 'material', 'materiales')}`;
      $('saludoTexto').textContent = 'Toca una portada para abrirla. Tu secreto de cada día te llega por WhatsApp.';
      caixa.append(estante('Tus materiales', '', meus, 0));
      const vids = estanteVideos(acesso.videos);
      if (vids) caixa.append(vids);
      for (const n of [2, 3]) {
        if (n <= nivel) continue;
        const faltan = de(n);
        const extraVid = qtdVideos(n) ? ` y ${plural(qtdVideos(n), 'video', 'videos')}` : '';
        caixa.append(estante(`Vienen en el ${KIT[n]}`, `${plural(faltan.length, 'material más', 'materiales más')}${extraVid}. Si los quieres, avísame por WhatsApp y te digo cómo completar tu aportación.`, faltan, 0));
      }
    } else {
      caixa.append(estante('Material prometido', 'Te entregué tu receta antes de tu pago, confiando en ti, como acordamos. Ahora falta tu parte: elige uno de los kits de abajo y haz tu pago para abrirlo.', D.catalogo.filter((m) => m.gratis), 0));
      const elige = document.createElement('h2');
      elige.className = 'elige';
      elige.textContent = 'Elige tu kit';
      caixa.append(elige);
      const vid = (n) => (qtdVideos(n) ? `, ${plural(qtdVideos(n), 'video', 'videos')} paso a paso` : '');
      caixa.append(estante(`${KIT[1]} · $119`, `Tu receta, estos 2 bonos${vid(1)} y un secreto al día por 30 días`, de(1).filter((m) => !m.gratis), 0));
      caixa.append(estante(`${KIT[2]} · $179`, `Todo el ${KIT[1]}, ${plural(de(2).length, 'material', 'materiales')} más${vid(2)}`, de(2), 0));
      caixa.append(estante(`${KIT[3]} · $239`, `Todo el ${KIT[2]}, ${plural(de(3).length, 'material', 'materiales')} más${vid(3)}`, de(3), 0));
    }
  }

  let timerAviso;
  function avisar(t) {
    const a = $('aviso');
    a.textContent = t;
    a.classList.add('visivel');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => a.classList.remove('visivel'), 3600);
  }

  function fechado(m) {
    if (!acesso) {
      avisar(`Primero escribe tu clave. Este material viene en el ${KIT[m.nivel]}.`);
      $('campoClave').focus();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    avisar(`Este material viene en el ${KIT[m.nivel]}.`);
  }

  $('formClave').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const campo = $('campoClave');
    const aviso = $('claveAviso');
    const btn = $('btnClave');
    if (!normal(campo.value)) {
      aviso.textContent = 'Primero escribe la clave que te llegó por WhatsApp.';
      aviso.classList.add('erro');
      campo.focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Abriendo';
    aviso.classList.remove('erro');
    aviso.textContent = 'Revisando tu clave...';
    let r = null;
    try { r = await abrirCofre(campo.value); } catch { r = null; }
    btn.disabled = false;
    btn.textContent = 'Abrir';
    if (!r) {
      aviso.textContent = 'Esa clave no abrió nada. Revísala en nuestra conversación de WhatsApp y escríbela otra vez.';
      aviso.classList.add('erro');
      const f = $('formClave');
      f.classList.remove('sacude');
      void f.offsetWidth;
      f.classList.add('sacude');
      campo.focus();
      return;
    }
    acesso = r;
    guardar.pôr(CHAVE_LOCAL, normal(campo.value));
    campo.value = '';
    aviso.textContent = '';
    desenhar(true);
    $('saludo').focus({ preventScroll: true });
    $('saludo').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('btnSalir').addEventListener('click', () => {
    acesso = null;
    guardar.tirar(CHAVE_LOCAL);
    $('claveAviso').textContent = 'Las mayúsculas, los acentos y los espacios no importan.';
    desenhar(false);
    window.scrollTo(0, 0);
  });

  /* ---------- leitor ---------- */
  let pdfjsCarga = null;
  function carregarPdfjs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (!pdfjsCarga) {
      pdfjsCarga = new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'vendor/pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; res(window.pdfjsLib); };
        s.onerror = () => { pdfjsCarga = null; rej(new Error('pdfjs')); };
        document.head.append(s);
      });
    }
    return pdfjsCarga;
  }

  const planos = new Map();
  async function baixarPdf(m) {
    if (planos.has(m.id)) return planos.get(m.id);
    if (m.gratis) {
      const r = await fetch(`gratis/${m.id}.pdf`);
      if (!r.ok) throw new Error('rede');
      const livre = await r.arrayBuffer();
      planos.set(m.id, livre);
      return livre;
    }
    const reg = acesso.archivos[m.id];
    const resp = await fetch(`conteudo/${reg.arq}`);
    if (!resp.ok) throw new Error('rede');
    const buf = new Uint8Array(await resp.arrayBuffer());
    const chave = await crypto.subtle.importKey('raw', b64(reg.chave), 'AES-GCM', false, ['decrypt']);
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, chave, buf.slice(12));
    planos.set(m.id, plano);
    return plano;
  }

  let L = null; // leitor aberto: { m, doc, obs, urlBaixar, render:Set }
  let voltarFoco = null;

  function estadoLeitor(texto, tentar) {
    const e = $('leitorEstado');
    e.textContent = texto;
    if (tentar) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Intentar otra vez';
      b.addEventListener('click', tentar);
      e.append(b);
    }
  }

  async function abrirLeitor(m) {
    voltarFoco = document.activeElement;
    fecharLeitor(true);
    $('leitor').hidden = false;
    document.body.style.overflow = 'hidden';
    $('pagina').inert = true;
    $('leitorTitulo').textContent = m.titulo;
    $('leitorPagina').textContent = `${plural(m.paginas, 'página', 'páginas')} · ${String(m.mb).replace('.', ',')} MB`;
    $('leitorBajar').removeAttribute('href');
    history.pushState({ leitor: m.id }, '');
    $('leitorVolver').focus();
    const atual = (L = { m, render: new Set() });
    const tentar = async () => {
      estadoLeitor('Abriendo tu material...');
      try {
        const [pdfjs, plano] = await Promise.all([carregarPdfjs(), baixarPdf(m)]);
        if (L !== atual) return;
        atual.urlBaixar = URL.createObjectURL(new Blob([plano], { type: 'application/pdf' }));
        const bajar = $('leitorBajar');
        bajar.href = atual.urlBaixar;
        bajar.download = m.titulo.replace(/[^\p{L}\p{N} ]/gu, '') + '.pdf';
        atual.doc = await pdfjs.getDocument({ data: new Uint8Array(plano.slice(0)) }).promise;
        if (L !== atual) return;
        estadoLeitor('');
        await montarFolhas(atual);
      } catch {
        if (L === atual) estadoLeitor('No se pudo abrir. Revisa tu internet y vuelve a intentarlo.', tentar);
      }
    };
    tentar();
  }

  async function montarFolhas(atual) {
    const area = $('leitorArea');
    const primeira = await atual.doc.getPage(1);
    const vp = primeira.getViewport({ scale: 1 });
    const total = atual.doc.numPages;
    const frag = document.createDocumentFragment();
    for (let n = 1; n <= total; n++) {
      const d = document.createElement('div');
      d.className = 'folha';
      d.dataset.n = n;
      d.style.aspectRatio = `${vp.width} / ${vp.height}`;
      frag.append(d);
    }
    area.replaceChildren(frag);
    atual.obs = new IntersectionObserver((ents) => {
      for (const e of ents) {
        if (e.isIntersecting) desenharFolha(atual, e.target);
        else limparFolha(atual, e.target);
      }
    }, { root: area, rootMargin: '900px 0px' });
    area.querySelectorAll('.folha').forEach((d) => atual.obs.observe(d));
    const salva = Number(guardar.ler('gelatina.pag.' + atual.m.id)) || 1;
    const alvo = area.querySelector(`.folha[data-n="${Math.min(salva, total)}"]`);
    if (salva > 1 && alvo) area.scrollTop = alvo.offsetTop - area.offsetTop;
    atual.total = total;
    numeroPagina();
  }

  async function desenharFolha(atual, d) {
    const n = Number(d.dataset.n);
    if (atual.render.has(n)) return;
    atual.render.add(n);
    try {
      const page = await atual.doc.getPage(n);
      if (L !== atual || !atual.render.has(n)) return;
      const base = page.getViewport({ scale: 1 });
      const escala = (d.clientWidth * Math.min(window.devicePixelRatio || 1, 2)) / base.width;
      const vp = page.getViewport({ scale: escala });
      const c = document.createElement('canvas');
      c.width = Math.floor(vp.width);
      c.height = Math.floor(vp.height);
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      if (L === atual && atual.render.has(n)) d.replaceChildren(c);
    } catch { atual.render.delete(n); }
  }

  function limparFolha(atual, d) {
    atual.render.delete(Number(d.dataset.n));
    d.replaceChildren(); // libera a memória das páginas longe da tela
  }

  function numeroPagina() {
    if (!L || !L.total) return;
    const area = $('leitorArea');
    const meio = area.scrollTop + area.clientHeight * 0.4;
    let atual = 1;
    for (const d of area.children) {
      if (d.offsetTop - area.offsetTop <= meio) atual = Number(d.dataset.n); else break;
    }
    $('leitorPagina').textContent = `Página ${atual} de ${L.total}`;
    guardar.pôr('gelatina.pag.' + L.m.id, String(atual));
  }
  let quadro = 0;
  $('leitorArea').addEventListener('scroll', () => {
    cancelAnimationFrame(quadro);
    quadro = requestAnimationFrame(numeroPagina);
  }, { passive: true });

  function fecharLeitor(semHistorico) {
    if (L) {
      if (L.obs) L.obs.disconnect();
      if (L.doc) L.doc.destroy();
      if (L.urlBaixar) URL.revokeObjectURL(L.urlBaixar);
      L = null;
    }
    $('leitorArea').replaceChildren();
    estadoLeitor('');
    if ($('leitor').hidden) return;
    $('leitor').hidden = true;
    document.body.style.overflow = '';
    $('pagina').inert = false;
    if (voltarFoco && voltarFoco.isConnected) voltarFoco.focus({ preventScroll: true });
    if (!semHistorico) history.back();
  }
  $('leitorVolver').addEventListener('click', () => fecharLeitor(false));
  window.addEventListener('popstate', () => { if (!$('leitor').hidden) fecharLeitor(true); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('leitor').hidden) fecharLeitor(false); });

  /* ---------- início: quem já entrou neste celular volta direto ---------- */
  (async () => {
    desenhar(false);
    // link grátis do WhatsApp: abre a receita direto, sem clave
    if (location.hash === '#receta') {
      history.replaceState(null, '', location.pathname + location.search);
      // cai na seção Material prometido, com os kits logo abaixo, em vez de abrir o PDF direto
      const secao = document.querySelector('#estantes .estante');
      if (secao) requestAnimationFrame(() => secao.scrollIntoView({ block: 'start' }));
    }
    // link da entrega: a clave vem depois do #, que não vai pro servidor, e sai da barra de endereço na hora
    const doLink = new URLSearchParams(location.hash.slice(1)).get('clave');
    if (doLink) {
      history.replaceState(null, '', location.pathname + location.search);
      let r = null;
      try { r = await abrirCofre(doLink); } catch { r = null; }
      if (r) {
        acesso = r;
        guardar.pôr(CHAVE_LOCAL, normal(doLink));
        desenhar(true);
        return;
      }
      $('claveAviso').textContent = 'Ese enlace no abrió nada. Escribe aquí la clave que te llegó con tu compra.';
      $('claveAviso').classList.add('erro');
    }
    const salva = guardar.ler(CHAVE_LOCAL);
    if (!salva) return;
    let r = null;
    try { r = await abrirCofre(salva); } catch { r = null; }
    if (r) { acesso = r; desenhar(false); } else guardar.tirar(CHAVE_LOCAL);
  })();
})();
