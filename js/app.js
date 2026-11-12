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
    b.addEventListener('click', () => abrirCine(v));
    li.append(b);
    return li;
  }

  /* ---------- cine: o vídeo do YouTube fica por baixo de um véu e nenhum botão dele recebe toque.
     Ela só tem tocar e pausar e tela cheia (os nossos). Mesmo esquema da área do curso de sabonete. ---------- */
  const ICO = {
    tocar: '<svg class="i-tocar" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
    pausar: '<svg class="i-pausar" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor"/></svg>',
    abrir: '<svg class="i-abrir" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fechar: '<svg class="i-fechar" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    de_novo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };
  const ehIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let ytCarga = null;
  function carregarYT() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (!ytCarga) {
      ytCarga = new Promise((res, rej) => {
        const antes = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { if (typeof antes === 'function') antes(); res(window.YT); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.async = true;
        s.onerror = () => { ytCarga = null; rej(new Error('yt')); };
        document.head.append(s);
        setTimeout(() => rej(new Error('yt demorou')), 12000);
      });
    }
    return ytCarga;
  }

  const C = { yt: null, v: null, tOcioso: 0, tInicio: 0, foco: null };
  const cine = document.createElement('div');
  cine.className = 'cine';
  cine.hidden = true;
  cine.setAttribute('role', 'dialog');
  cine.setAttribute('aria-modal', 'true');
  cine.setAttribute('aria-labelledby', 'cineTitulo');
  cine.innerHTML = `<div class="cine-barra">
      <button class="icono cine-volver" type="button" aria-label="Volver"><svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      <h2 id="cineTitulo" class="cine-titulo"></h2>
    </div>
    <div class="cine-palco"><div class="tela" data-estado="carregando">
      <div class="tela-alvo"></div>
      <div class="tela-veu" data-tela="veu"></div>
      <button class="tela-centro" type="button" data-tela="tocar" aria-label="Reproducir o pausar">${ICO.tocar}${ICO.pausar}</button>
      <div class="tela-fim"><button class="tela-de-novo" type="button" data-tela="de-novo">${ICO.de_novo}<span>Ver otra vez</span></button></div>
      <div class="tela-barra">
        <button class="tela-btn" type="button" data-tela="tocar" aria-label="Reproducir o pausar">${ICO.tocar}${ICO.pausar}</button>
        <span class="tela-espaco"></span>
        <button class="tela-btn" type="button" data-tela="cheia" aria-label="Pantalla completa">${ICO.abrir}${ICO.fechar}</button>
      </div>
      <div class="tela-aviso" aria-live="polite"></div>
    </div>
    <aside class="cine-nota" hidden>
      <h3>Hazla sin azúcar</h3>
      <p>Donde el video pone azúcar, usa <b>Splenda en sobre</b> (el amarillito, de sucralosa). Lo encuentras en cualquier súper, farmacia u OXXO, no amarga y aguanta el agua caliente.</p>
      <ul>
        <li><b>1 sobre</b> por cada 2 cucharaditas de azúcar.</li>
        <li><b>1 taza de azúcar</b> = 24 sobres. Si te gusta menos dulce, con 12 a 15 queda rica.</li>
        <li>Si lleva <b>leche condensada</b>, usa 1 lata de leche evaporada con 10 sobres de Splenda. Prueba y agrega más si la quieres más dulce.</li>
      </ul>
      <p class="cine-nota-medida" hidden></p>
    </aside></div>`;
  document.body.append(cine);
  const tela = cine.querySelector('.tela');
  const avisoTela = (t) => {
    const a = tela.querySelector('.tela-aviso');
    a.textContent = t;
    a.classList.add('visivel');
    clearTimeout(a._t);
    a._t = setTimeout(() => a.classList.remove('visivel'), 1800);
  };
  const estadoTela = (e) => { tela.dataset.estado = e; };
  function acordarTela(ms = 2600) {
    tela.removeAttribute('data-ocioso');
    clearTimeout(C.tOcioso);
    C.tOcioso = setTimeout(() => { if (tela.dataset.estado === 'tocando') tela.setAttribute('data-ocioso', ''); }, ms);
  }
  // o iframe fica inerte; só fica livre no celular que exige o primeiro toque no próprio vídeo (iPhone)
  function videoLivre(livre) {
    tela.toggleAttribute('data-livre', livre);
    const f = tela.querySelector('iframe');
    if (f) { f.tabIndex = -1; f.inert = !livre; }
  }
  function conferirInicio() {
    clearTimeout(C.tInicio);
    C.tInicio = setTimeout(() => {
      const yt = C.yt;
      if (!yt || !yt.getPlayerState) return;
      const st = yt.getPlayerState();
      if (st !== 1 && st !== 3) { videoLivre(true); avisoTela('Toca el video para empezar'); }
    }, 1600);
  }
  function aoMudarEstado(ev) {
    const S = window.YT.PlayerState;
    if (ev.data === S.PLAYING) { clearTimeout(C.tInicio); videoLivre(false); estadoTela('tocando'); acordarTela(4500); }
    else if (ev.data === S.BUFFERING) estadoTela('carregando');
    else if (ev.data === S.ENDED) { estadoTela('fim'); tela.removeAttribute('data-ocioso'); }
    else { estadoTela('pausado'); acordarTela(); }
  }
  const cheiaAgora = () => document.fullscreenElement || document.webkitFullscreenElement || tela.classList.contains('tela-cheia');
  function alternarCheia() {
    if (cheiaAgora()) { sairDaCheia(); return; }
    const pedir = tela.requestFullscreen || tela.webkitRequestFullscreen;
    const reserva = () => { tela.classList.add('tela-cheia'); marcarCheia(); };
    if (!pedir) { reserva(); return; }
    try {
      Promise.resolve(pedir.call(tela))
        .then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch { /* sem giro */ } })
        .catch(reserva);
    } catch { reserva(); }
  }
  function sairDaCheia() {
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* já saiu */ }
    }
    tela.classList.remove('tela-cheia');
    try { screen.orientation.unlock(); } catch { /* nada */ }
    marcarCheia();
  }
  function marcarCheia() {
    const on = Boolean(cheiaAgora());
    tela.toggleAttribute('data-cheia', on);
    tela.querySelector('[data-tela="cheia"]').setAttribute('aria-label', on ? 'Salir de pantalla completa' : 'Pantalla completa');
  }
  document.addEventListener('fullscreenchange', marcarCheia);
  document.addEventListener('webkitfullscreenchange', marcarCheia);

  tela.addEventListener('pointerdown', (e) => { tela._toque = e.pointerType === 'touch'; }, { passive: true });
  tela.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') acordarTela(); }, { passive: true });
  tela.addEventListener('dblclick', (e) => { if (!tela._toque && e.target.closest('[data-tela="veu"]')) alternarCheia(); });
  tela.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tela]');
    if (!b) return;
    const acao = b.dataset.tela;
    const yt = C.yt;
    // no celular, com o vídeo tocando, tocar no vídeo só mostra ou esconde os botões (como no app do YouTube)
    if (acao === 'veu' && tela._toque && tela.dataset.estado === 'tocando') {
      if (tela.hasAttribute('data-ocioso')) acordarTela(); else { clearTimeout(C.tOcioso); tela.setAttribute('data-ocioso', ''); }
      return;
    }
    if (acao === 'veu' && tela.dataset.estado === 'fim') return;
    acordarTela();
    if (acao === 'cheia') { alternarCheia(); return; }
    if (!yt || !yt.getPlayerState) return;
    if (acao === 'de-novo') { yt.seekTo(0, true); yt.playVideo(); return; }
    const st = yt.getPlayerState();
    if (st === 1 || st === 3) yt.pauseVideo(); else { yt.playVideo(); conferirInicio(); }
  });

  // a legenda automática do YouTube vem na língua do navegador (português aqui no PC): desliga
  function semLegenda(yt) { try { yt.unloadModule('captions'); yt.unloadModule('cc'); } catch { /* sem legenda */ } }
  // nada rola dentro da moldura (o foco no iframe empurrava o vídeo pra cima)
  tela.addEventListener('scroll', () => { tela.scrollTop = 0; tela.scrollLeft = 0; });

  async function abrirCine(v) {
    C.foco = document.activeElement;
    C.v = v;
    cine.querySelector('#cineTitulo').textContent = v.tema;
    const nota = cine.querySelector('.cine-nota');
    nota.hidden = !v.az;
    const medida = nota.querySelector('.cine-nota-medida');
    medida.hidden = typeof v.az !== 'string';
    medida.textContent = typeof v.az === 'string' ? v.az : '';
    cine.hidden = false;
    document.body.style.overflow = 'hidden';
    $('pagina').inert = true;
    history.pushState({ cine: v.id }, '');
    cine.querySelector('.cine-volver').focus();
    estadoTela('carregando');
    tela.removeAttribute('data-ocioso');
    try {
      const YT = await carregarYT();
      if (C.v !== v) return;
      tela.querySelector('.tela-alvo').replaceChildren(Object.assign(document.createElement('div'), { id: 'ytAlvo' }));
      C.yt = new YT.Player('ytAlvo', {
        host: 'https://www.youtube-nocookie.com',
        videoId: v.id,
        width: '100%',
        height: '100%',
        // sem os controles do YouTube, sem atalhos de teclado, sem o botão de tela cheia dele e sem anotações
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, cc_load_policy: 0, hl: 'es', playsinline: 1, origin: location.origin },
        events: {
          onReady: (e) => { semLegenda(e.target); videoLivre(false); conferirInicio(); },
          onStateChange: (ev) => { if (ev.data === 1) semLegenda(ev.target); aoMudarEstado(ev); },
        },
      });
      videoLivre(false);
    } catch {
      if (C.v === v) avisoTela('No se pudo cargar el video. Revisa tu internet.');
    }
  }
  function fecharCine(semHistorico) {
    if (cine.hidden) return;
    clearTimeout(C.tInicio);
    clearTimeout(C.tOcioso);
    sairDaCheia();
    if (C.yt) { try { C.yt.destroy(); } catch { /* já foi */ } }
    C.yt = null;
    C.v = null;
    tela.querySelector('.tela-alvo').replaceChildren();
    cine.hidden = true;
    document.body.style.overflow = '';
    $('pagina').inert = false;
    if (C.foco && C.foco.isConnected) C.foco.focus({ preventScroll: true });
    if (!semHistorico) history.back();
  }
  cine.querySelector('.cine-volver').addEventListener('click', () => fecharCine(false));
  window.addEventListener('popstate', () => fecharCine(true));
  document.addEventListener('keydown', (e) => {
    if (cine.hidden) return;
    if (e.key === 'Escape') { if (cheiaAgora()) sairDaCheia(); else fecharCine(false); }
    else if (e.key === ' ' && e.target === document.body) { e.preventDefault(); tela.querySelector('.tela-centro').click(); }
  });

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


  // ---- Tu agua de hoy: peso -> meta, contador de vasos. Todo queda en este celular.
  const AGUA = $('agua');
  const CHAVE_AGUA = 'gelatina.agua';
  const TOPE_LITROS = 4;
  const dia = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const estadoAgua = { peso: 0, dia: dia(), vasos: 0 };
  try {
    const e = JSON.parse(guardar.ler(CHAVE_AGUA) || '{}');
    estadoAgua.peso = Number(e.peso) || 0;
    if (e.dia === dia()) estadoAgua.vasos = Math.max(0, Math.floor(Number(e.vasos) || 0));
  } catch { /* sin datos guardados: empieza de cero */ }
  const guardarAgua = () => guardar.pôr(CHAVE_AGUA, JSON.stringify(estadoAgua));
  const num = (n) => String(Number(n.toFixed(2)));

  function metaAgua(peso) {
    if (!(peso >= 30 && peso <= 250)) return null;
    const bruto = peso / 20;
    const vasos = Math.round(Math.min(bruto, TOPE_LITROS) * 4); // vasos de 250 ml
    return { vasos, litros: vasos / 4, tope: bruto > TOPE_LITROS };
  }

  function pintarAgua() {
    if (estadoAgua.dia !== dia()) { estadoAgua.dia = dia(); estadoAgua.vasos = 0; }
    const meta = metaAgua(estadoAgua.peso);
    const seguir = $('aguaSeguir');
    seguir.hidden = !meta;
    if (!meta) {
      $('aguaMeta').textContent = estadoAgua.peso ? 'Escribe tu peso en kilos, entre 30 y 250. Por ejemplo: 68.' : '';
      return;
    }
    estadoAgua.vasos = Math.min(estadoAgua.vasos, meta.vasos);
    $('aguaMeta').innerHTML = `Tu meta de hoy: <strong>${num(meta.litros)} litros</strong>, que son <strong>${meta.vasos} vasos</strong> de 250 ml.` +
      (meta.tope ? `<small>Por seguridad, el máximo que te propongo es ${TOPE_LITROS} litros al día.</small>` : '');
    const lista = $('aguaVasos');
    if (lista.children.length !== meta.vasos) {
      lista.replaceChildren(...Array.from({ length: meta.vasos }, () => {
        const li = document.createElement('li');
        li.className = 'vaso';
        li.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path class="fundo" d="M5.2 3.2h13.6l-1.7 16.6a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8L5.2 3.2Z"/><g clip-path="url(#vaso-clip)"><rect class="nivel" x="4" y="7" width="16" height="15"/></g><path class="borde" d="M5.2 3.2h13.6l-1.7 16.6a2 2 0 0 1-2 1.8H8.9a2 2 0 0 1-2-1.8L5.2 3.2Z"/></svg>';
        return li;
      }));
    }
    [...lista.children].forEach((li, i) => li.classList.toggle('lleno', i < estadoAgua.vasos));
    const listo = estadoAgua.vasos >= meta.vasos;
    const cuenta = $('aguaCuenta');
    cuenta.textContent = listo ? '¡Meta de hoy cumplida! Así se hace.' : `Llevas ${estadoAgua.vasos} de ${meta.vasos} vasos.`;
    cuenta.classList.toggle('listo', listo);
    $('aguaMas').disabled = listo;
    $('aguaMas').textContent = listo ? 'Listo por hoy' : 'Tomé un vaso';
    $('aguaMenos').disabled = estadoAgua.vasos === 0;
    retoAgua(listo);
    // reparto del día: 40% en la mañana, 40% en la tarde, el resto en la noche
    const manana = Math.round(meta.vasos * 0.4);
    const tarde = Math.round(meta.vasos * 0.4);
    $('aguaReparte').textContent = `Reparte tus vasos así: ${manana} en la mañana, ${tarde} en la tarde y ${meta.vasos - manana - tarde} en la noche.`;
  }

  function iniciarAgua() {
    const campo = $('aguaPeso');
    if (estadoAgua.peso) campo.value = String(estadoAgua.peso);
    campo.addEventListener('input', () => {
      const n = parseFloat(campo.value.replace(',', '.'));
      estadoAgua.peso = Number.isFinite(n) ? n : 0;
      guardarAgua();
      pintarAgua();
    });
    campo.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); campo.blur(); } });
    $('aguaMas').addEventListener('click', () => {
      const meta = metaAgua(estadoAgua.peso);
      if (!meta || estadoAgua.vasos >= meta.vasos) return;
      estadoAgua.vasos += 1;
      guardarAgua();
      pintarAgua();
      if (estadoAgua.vasos >= meta.vasos) avisar('¡Meta de agua cumplida hoy!');
    });
    $('aguaMenos').addEventListener('click', () => {
      if (estadoAgua.vasos > 0) { estadoAgua.vasos -= 1; guardarAgua(); pintarAgua(); }
    });
  }
  iniciarAgua();


  // ---- Ferramentas do kit: reto, recordatorios, súper y avance. Todo queda en este celular.
  const BOT_WA = '558782003947';
  const HERR = ['reto', 'agua', 'recordar', 'super', 'avance'].map((id) => $(id));
  const lerJson = (k, pad) => { try { const v = JSON.parse(guardar.ler(k) || 'null'); return v && typeof v === 'object' ? v : pad; } catch { return pad; } };
  const usar = (id) => `<svg width="26" height="26" aria-hidden="true"><use href="#${id}"/></svg>`;
  const diaDe = (s) => { const [a, m, d] = s.split('-').map(Number); return Date.UTC(a, m - 1, d); };
  const somaDias = (s, n) => { const t = new Date(diaDe(s) + n * 864e5); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`; };
  const entre = (a, b) => Math.round((diaDe(b) - diaDe(a)) / 864e5);
  const dataCurta = (s) => new Date(diaDe(s)).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const dec = (n) => String(Math.round(n * 10) / 10);

  /* reto de 4 semanas */
  const HABITOS = [
    { id: 'gelatina', icone: 'i-gelatina', nome: 'Mi gelatina', dica: 'Unos cubitos antes de comer o a media tarde' },
    { id: 'agua', icone: 'i-gota', nome: 'Mi agua', dica: 'Se marca sola cuando llegas a tu meta de vasos' },
    { id: 'mover', icone: 'i-pasos', nome: 'Me moví', dica: 'Caminar, bailar o una rutina: 10 minutos ya cuentan' },
    { id: 'dormir', icone: 'i-luna', nome: 'Dormí a mi hora', dica: 'Más o menos a la misma hora que ayer' },
    { id: 'horas', icone: 'i-reloj', nome: 'Comí a mis horas', dica: 'Desayuno, comida y cena a tiempo' },
  ];
  const SEMANAS = [
    { nome: 'Arranque', estrella: 'agua', estrellaTxt: 'el agua', meta: 20, medalla: 'bronce', medallaTxt: 'medalla de bronce', curta: 'Bronce' },
    { nome: 'Constancia', estrella: 'horas', estrellaTxt: 'comer a tus horas', meta: 24, medalla: 'plata', medallaTxt: 'medalla de plata', curta: 'Plata' },
    { nome: 'Fuerza', estrella: 'mover', estrellaTxt: 'moverte', meta: 28, medalla: 'oro', medallaTxt: 'medalla de oro', curta: 'Oro' },
    { nome: 'Campeona', estrella: 'dormir', estrellaTxt: 'dormir a tu hora', meta: 30, medalla: 'corona', medallaTxt: 'corona de campeona', curta: 'Corona' },
  ];
  const CORES_MEDALLA = { bronce: ['#c47d40', '#8d5124'], plata: ['#bcc4cb', '#7d8891'], oro: ['#f0b733', '#b9811a'], corona: ['#f4b740', '#b9811a'] };
  function medallaSVG(tipo, semana) {
    const [c1, c2] = CORES_MEDALLA[tipo];
    const centro = tipo === 'corona'
      ? '<path d="M24 61l3-11 6 6 3-9 3 9 6-6 3 11Z" fill="#fff8e6" stroke="#7c0b3d" stroke-width="2" stroke-linejoin="round"/>'
      : `<text x="36" y="60.5" text-anchor="middle" font-family="Bricolage, Figtree, sans-serif" font-weight="800" font-size="18" fill="#fff8e6">${semana}</text>`;
    return `<svg viewBox="0 0 72 84" aria-hidden="true"><path d="M21 2h13l6 27-13 4Z" fill="#9f1150"/><path d="M51 2H38l-6 27 13 4Z" fill="#7c0b3d"/><circle cx="36" cy="55" r="25" fill="${c2}"/><circle cx="36" cy="55" r="20" fill="${c1}" stroke="#fff8e6" stroke-opacity=".6" stroke-width="1.6"/>${centro}</svg>`;
  }

  const CHAVE_RETO = 'gelatina.reto';
  const reto = lerJson(CHAVE_RETO, { inicio: null, dias: {}, avisadas: [] });
  if (!reto.dias || typeof reto.dias !== 'object') reto.dias = {};
  if (!Array.isArray(reto.avisadas)) reto.avisadas = [];
  const guardarReto = () => guardar.pôr(CHAVE_RETO, JSON.stringify(reto));
  const marcadosHoy = () => reto.dias[dia()] || [];

  function infoReto() {
    const hoy = dia();
    const idx = reto.inicio ? Math.max(0, entre(reto.inicio, hoy)) : 0;
    const fin = idx >= 28;
    const sem = Math.min(3, Math.floor(idx / 7));
    const inicioSem = reto.inicio ? somaDias(reto.inicio, sem * 7) : hoy;
    const diasSem = Array.from({ length: 7 }, (_, i) => somaDias(inicioSem, i));
    const puntosSem = (s) => {
      if (!reto.inicio) return 0;
      let t = 0;
      for (let i = 0; i < 7; i++) t += (reto.dias[somaDias(reto.inicio, s * 7 + i)] || []).length;
      return t;
    };
    return { hoy, idx, fin, sem, diasSem, puntosSem };
  }

  // días seguidos con 3 puntos o más; hoy solo cuenta cuando ya llegó; un día de gracia por semana
  function racha() {
    if (!reto.inicio) return 0;
    let d = dia();
    if ((reto.dias[d] || []).length < 3) d = somaDias(d, -1);
    let n = 0;
    const gracia = new Set();
    while (entre(reto.inicio, d) >= 0) {
      if ((reto.dias[d] || []).length >= 3) n++;
      else {
        const s = Math.floor(entre(reto.inicio, d) / 7);
        if (n === 0 || gracia.has(s)) break;
        gracia.add(s);
      }
      d = somaDias(d, -1);
    }
    return n;
  }

  const LETRA = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  function pintarReto() {
    const I = infoReto();
    const S = SEMANAS[I.sem];
    $('retoSemana').textContent = I.fin
      ? 'Terminaste tus 4 semanas. ¡Qué orgullo!'
      : `Semana ${I.sem + 1} de 4: ${S.nome}. Día ${I.idx + 1} de 28. Tu hábito estrella es ${S.estrellaTxt}.`;

    const ul = $('retoHoy');
    if (!ul.children.length) {
      ul.replaceChildren(...HABITOS.map((h) => {
        const li = document.createElement('li');
        li.innerHTML = `<button type="button" class="habito" data-h="${h.id}" aria-pressed="false">${usar(h.icone)}<span class="habito-txt"><b>${h.nome}<span class="estrella" hidden>Estrella de la semana</span></b><small>${h.dica}</small></span><span class="marca" aria-hidden="true"><svg><use href="#i-check"/></svg></span></button>`;
        return li;
      }));
    }
    const hoy = marcadosHoy();
    ul.querySelectorAll('.habito').forEach((b) => {
      b.setAttribute('aria-pressed', String(hoy.includes(b.dataset.h)));
      b.querySelector('.estrella').hidden = I.fin || b.dataset.h !== S.estrella;
      b.disabled = I.fin;
    });

    const pts = I.puntosSem(I.sem);
    $('retoPuntos').innerHTML = I.fin ? '' : pts >= S.meta
      ? `Hoy: <strong>${hoy.length} de 5</strong> puntos. Esta semana: <strong>${pts}</strong>, ya ganaste tu ${S.medallaTxt}.`
      : `Hoy: <strong>${hoy.length} de 5</strong> puntos. Esta semana: <strong>${pts} de ${S.meta}</strong> para tu ${S.medallaTxt}.`;

    const ol = $('retoDias');
    ol.hidden = I.fin;
    if (ol.dataset.semana !== I.diasSem[0]) {
      ol.dataset.semana = I.diasSem[0];
      ol.replaceChildren(...I.diasSem.map(() => { const li = document.createElement('li'); li.className = 'dia'; li.innerHTML = '<div class="barra"><i></i></div><span class="num"></span><span class="letra"></span>'; return li; }));
    }
    [...ol.children].forEach((li, i) => {
      const d = I.diasSem[i];
      const p = (reto.dias[d] || []).length;
      const futuro = diaDe(d) > diaDe(I.hoy);
      li.className = 'dia' + (d === I.hoy ? ' hoy' : '') + (futuro ? ' futuro' : '');
      li.querySelector('i').style.setProperty('--p', futuro ? 0 : p);
      li.querySelector('.num').textContent = futuro ? ' ' : p;
      li.querySelector('.letra').textContent = d === I.hoy ? 'Hoy' : LETRA[new Date(diaDe(d)).getUTCDay()];
      li.setAttribute('aria-label', `${d === I.hoy ? 'Hoy' : dataCurta(d)}: ${futuro ? 'todavía no llega' : p + ' puntos'}`);
    });

    const r = racha();
    $('retoRacha').textContent = I.fin ? '' : r >= 2
      ? `Llevas ${r} días seguidos con 3 puntos o más. Si un día fallas, tienes un día de gracia por semana.`
      : 'Haz 3 puntos o más cada día y empieza tu racha.';

    $('retoMedallas').replaceChildren(...SEMANAS.map((s, i) => {
      const ganada = I.puntosSem(i) >= s.meta;
      const li = document.createElement('li');
      li.className = 'medalla' + (ganada ? '' : ' bloqueada');
      li.innerHTML = `${medallaSVG(s.medalla, i + 1)}<b>${s.curta}</b><small>${ganada ? 'Ganada' : `Semana ${i + 1}`}</small>`;
      return li;
    }));

    const atual = I.fin ? 3 : I.sem;
    const ganhou = I.puntosSem(atual) >= SEMANAS[atual].meta;
    $('retoGanaste').hidden = !ganhou;
    if (ganhou) {
      $('retoGanasteMedalla').innerHTML = medallaSVG(SEMANAS[atual].medalla, atual + 1);
      $('retoGanasteTexto').textContent = `¡Ganaste tu ${SEMANAS[atual].medallaTxt}! Compártela con tus amigas.`;
    }
    const ganadas = SEMANAS.filter((s, i) => I.puntosSem(i) >= s.meta).length;
    $('retoFin').hidden = !I.fin;
    $('retoFin').textContent = I.fin ? `Ganaste ${ganadas} de 4 medallas. Puedes empezar otra vuelta cuando quieras: tus medallas de esta vuelta se borran.` : '';
    $('retoReiniciar').hidden = !I.fin;
  }

  function marcarHabito(h, on, silencio = false) {
    if (infoReto().fin) return;
    if (!reto.inicio) reto.inicio = dia();
    const hoy = dia();
    const l = new Set(reto.dias[hoy] || []);
    if (on) l.add(h); else l.delete(h);
    reto.dias[hoy] = HABITOS.map((x) => x.id).filter((x) => l.has(x));
    guardarReto();
    const I = infoReto();
    const s = SEMANAS[I.sem];
    const chave = `${reto.inicio}:${I.sem}`;
    if (on && I.puntosSem(I.sem) >= s.meta && !reto.avisadas.includes(chave)) {
      reto.avisadas.push(chave);
      guardarReto();
      avisar(`¡Ganaste tu ${s.medallaTxt}!`);
    } else if (on && !silencio && reto.dias[hoy].length === 5) avisar('¡5 de 5 hoy! Día perfecto.');
    pintarReto();
  }
  // el contador de agua marca el hábito solo, cuando ella llega a su meta
  function retoAgua(listo) {
    if (listo && !marcadosHoy().includes('agua')) marcarHabito('agua', true, true);
  }

  $('retoHoy').addEventListener('click', (e) => {
    const b = e.target.closest('.habito');
    if (!b || b.disabled) return;
    marcarHabito(b.dataset.h, b.getAttribute('aria-pressed') !== 'true');
  });
  $('retoReiniciar').addEventListener('click', () => {
    if (!window.confirm('¿Empezar otra vuelta de 4 semanas? Tus puntos y medallas de esta vuelta se borran.')) return;
    reto.inicio = null; reto.dias = {}; reto.avisadas = [];
    guardarReto();
    pintarReto();
  });

  function imagemMedalla(s, n) {
    return new Promise((ok, falha) => {
      const c = document.createElement('canvas');
      c.width = 1080; c.height = 1080;
      const x = c.getContext('2d');
      x.fillStyle = '#fbf5ec'; x.fillRect(0, 0, 1080, 1080);
      const img = new Image();
      img.onload = () => {
        x.drawImage(img, 340, 110, 400, 467);
        x.textAlign = 'center';
        x.fillStyle = '#9f1150'; x.font = '800 78px Bricolage, Figtree, sans-serif';
        x.fillText(s.medalla === 'corona' ? '¡Soy campeona!' : `¡Gané mi medalla de ${s.medalla}!`, 540, 700, 980);
        x.fillStyle = '#2b1c15'; x.font = '600 44px Figtree, sans-serif';
        x.fillText(`Semana ${n} del reto de 4 semanas`, 540, 790);
        x.fillStyle = '#66534a'; x.font = '400 38px Figtree, sans-serif';
        x.fillText('El Truco de la Gelatina', 540, 860);
        c.toBlob((b) => (b ? ok(b) : falha(new Error('sin imagen'))), 'image/png');
      };
      img.onerror = () => falha(new Error('sin medalla'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(medallaSVG(s.medalla, n).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="467" '));
    });
  }
  $('retoCompartir').addEventListener('click', async () => {
    const I = infoReto();
    const i = I.fin ? 3 : I.sem;
    const s = SEMANAS[i];
    const texto = `¡Gané mi ${s.medallaTxt} en el reto de 4 semanas de El Truco de la Gelatina! 💛 Si tú también quieres la receta, escríbele a Camila: https://wa.me/${BOT_WA}?text=${encodeURIComponent('Hola Camila, quiero el truco de la gelatina')}`;
    try {
      const blob = await imagemMedalla(s, i + 1);
      const arq = new File([blob], `medalla-${s.medalla}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) { await navigator.share({ files: [arq], text: texto }); return; }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  });

  /* recordatorios por WhatsApp: el bot los manda; aquí solo se arma el mensaje */
  const CHAVE_RECORDAR = 'gelatina.recordar';
  const recordar = Object.assign({ despierto: 420, como: 840, duermo: 1380 }, lerJson(CHAVE_RECORDAR, {}));
  const mod = (m) => ((m % 1440) + 1440) % 1440;
  const hora12 = (m) => { const x = mod(m); const h = Math.floor(x / 60); return `${h % 12 || 12}:${String(x % 60).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`; };
  const hora24 = (m) => { const x = mod(m); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
  function opcoesHora(sel, de, ate, valor) {
    const ops = [];
    for (let m = de; m <= ate; m += 30) ops.push(`<option value="${mod(m)}"${mod(m) === valor ? ' selected' : ''}>${hora12(m)}</option>`);
    sel.innerHTML = ops.join('');
    if (![...sel.options].some((o) => o.selected)) sel.value = String(mod(de));
  }
  function linkRecordar() {
    let zona = 'America/Mexico_City';
    try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (/^America\//.test(z)) zona = z; } catch { /* usa la de Ciudad de México */ }
    const meta = metaAgua(estadoAgua.peso);
    const linhas = ['Quiero mis recordatorios ✅', `Despierto ${hora24(recordar.despierto)} · Como ${hora24(recordar.como)} · Duermo ${hora24(recordar.duermo)}`];
    if (meta) linhas.push(`Agua: ${meta.vasos} vasos`);
    linhas.push(`Zona: ${zona}`);
    return `https://wa.me/${BOT_WA}?text=${encodeURIComponent(linhas.join('\n'))}`;
  }
  function pintarRecordar() {
    const itens = [
      ['i-gota', recordar.despierto + 5, 'tu primer vaso de agua'],
      ['i-gelatina', recordar.como - 20, 'tu gelatina y un vaso de agua'],
      ['i-luna', recordar.duermo - 30, 'para prepararte a dormir y marcar tu día'],
    ];
    $('recordarResumen').innerHTML = itens.map(([ic, m, t]) => `<li><svg aria-hidden="true"><use href="#${ic}"/></svg><span><b>${hora12(m)}</b> ${t}</span></li>`).join('');
    $('recordarActivar').href = linkRecordar();
  }
  function iniciarRecordar() {
    opcoesHora($('horaDespierto'), 300, 660, recordar.despierto);
    opcoesHora($('horaComo'), 720, 1050, recordar.como);
    opcoesHora($('horaDuermo'), 1200, 1500, recordar.duermo);
    for (const [id, k] of [['horaDespierto', 'despierto'], ['horaComo', 'como'], ['horaDuermo', 'duermo']]) {
      recordar[k] = Number($(id).value);
      $(id).addEventListener('change', () => {
        recordar[k] = Number($(id).value);
        guardar.pôr(CHAVE_RECORDAR, JSON.stringify(recordar));
        pintarRecordar();
      });
    }
    $('recordarActivar').addEventListener('click', () => { $('recordarActivar').href = linkRecordar(); });
  }
  iniciarRecordar();

  /* lista del súper */
  const SUPER = [
    ['Grenetina sin sabor', '40 g por cada receta'],
    ['1 piña', 'Usas la cáscara, bien lavada'],
    ['Canela en raja', '2 rajas por receta'],
    ['Té verde', '1 cucharada'],
    ['Jengibre', 'Un trozo de unos 3 cm'],
    ['Cúrcuma', '1 cucharadita'],
    ['Vinagre de manzana', '1 cucharada de postre'],
    ['Limones o pepino', 'Para darle sabor a tu agua'],
  ];
  const CHAVE_SUPER = 'gelatina.super';
  const superEstado = lerJson(CHAVE_SUPER, { marcados: [] });
  if (!Array.isArray(superEstado.marcados)) superEstado.marcados = [];
  function pintarSuper() {
    const ul = $('superLista');
    if (!ul.children.length) {
      ul.replaceChildren(...SUPER.map(([nome, qtd], i) => {
        const li = document.createElement('li');
        li.innerHTML = `<label><input type="checkbox" data-i="${i}"><span>${nome}<small>${qtd}</small></span></label>`;
        return li;
      }));
    }
    ul.querySelectorAll('input').forEach((c) => { c.checked = superEstado.marcados.includes(Number(c.dataset.i)); });
    const faltan = SUPER.length - superEstado.marcados.length;
    $('superCuenta').textContent = faltan ? `Te ${faltan === 1 ? 'falta 1 cosa' : `faltan ${faltan} cosas`}.` : '¡Tienes todo para tu receta!';
  }
  $('superLista').addEventListener('change', (e) => {
    const i = Number(e.target.dataset.i);
    const s = new Set(superEstado.marcados);
    if (e.target.checked) s.add(i); else s.delete(i);
    superEstado.marcados = [...s].sort((a, b) => a - b);
    guardar.pôr(CHAVE_SUPER, JSON.stringify(superEstado));
    pintarSuper();
  });
  $('superLimpiar').addEventListener('click', () => {
    superEstado.marcados = [];
    guardar.pôr(CHAVE_SUPER, JSON.stringify(superEstado));
    pintarSuper();
  });

  /* tu avance: cintura y peso, solo en este celular, sin promesas */
  const CHAVE_AVANCE = 'gelatina.avance';
  const avance = lerJson(CHAVE_AVANCE, { entradas: [], foto: false });
  if (!Array.isArray(avance.entradas)) avance.entradas = [];
  const guardarAvance = () => guardar.pôr(CHAVE_AVANCE, JSON.stringify(avance));
  const lerNum = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
  function pintarAvance() {
    const E = avance.entradas;
    $('avFoto').checked = Boolean(avance.foto);
    if (!$('avPeso').value && estadoAgua.peso) $('avPeso').value = String(estadoAgua.peso);
    const res = $('avResumen');
    if (!E.length) res.textContent = '';
    else if (E.length === 1) res.textContent = `Tu día 1 quedó guardado. Vuelve a medirte el ${dataCurta(somaDias(E[0].dia, 7))}.`;
    else {
      const prim = E[0];
      const ult = E[E.length - 1];
      const partes = [];
      if (prim.cintura != null && ult.cintura != null) {
        const d = ult.cintura - prim.cintura;
        partes.push(d < 0 ? `${dec(-d)} cm menos de cintura` : d > 0 ? `${dec(d)} cm más de cintura` : 'la misma cintura');
      }
      if (prim.peso != null && ult.peso != null) {
        const d = ult.peso - prim.peso;
        partes.push(d < 0 ? `${dec(-d)} kg menos` : d > 0 ? `${dec(d)} kg más` : 'el mismo peso');
      }
      res.textContent = partes.length ? `Desde tu día 1: ${partes.join(' y ')}. Tu siguiente medida: ${dataCurta(somaDias(ult.dia, 7))}.` : '';
    }
    $('avLista').innerHTML = E.slice().reverse().slice(0, 6).map((e) =>
      `<li><span>${dataCurta(e.dia)}</span><span>${[e.cintura != null ? `${dec(e.cintura)} cm` : '', e.peso != null ? `${dec(e.peso)} kg` : ''].filter(Boolean).join(' · ')}</span></li>`).join('');
  }
  $('avGuardar').addEventListener('click', () => {
    let cintura = lerNum($('avCintura').value);
    let peso = lerNum($('avPeso').value);
    if (cintura != null && (cintura < 40 || cintura > 200)) cintura = null;
    if (peso != null && (peso < 30 || peso > 250)) peso = null;
    if (cintura == null && peso == null) { avisar('Escribe tu cintura en centímetros, por ejemplo 88.'); $('avCintura').focus(); return; }
    const hoy = dia();
    const resto = avance.entradas.filter((e) => e.dia !== hoy);
    avance.entradas = [...resto, { dia: hoy, cintura, peso }].sort((a, b) => diaDe(a.dia) - diaDe(b.dia));
    guardarAvance();
    $('avCintura').value = '';
    let msg = 'Guardado.';
    if (peso != null && peso !== estadoAgua.peso) {
      estadoAgua.peso = peso;
      $('aguaPeso').value = String(peso);
      guardarAgua();
      pintarAgua();
      msg = 'Guardado. Tu meta de agua se ajustó a tu peso.';
    }
    avisar(msg);
    pintarAvance();
  });
  $('avFoto').addEventListener('change', (e) => { avance.foto = e.target.checked; guardarAvance(); });

  function pintarFerramentas() {
    pintarAgua();
    pintarReto();
    pintarRecordar();
    pintarSuper();
    pintarAvance();
  }
  // si el día cambió con la página abierta, al volver se ve el día nuevo
  document.addEventListener('visibilitychange', () => { if (!document.hidden && acesso) pintarFerramentas(); });

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
      for (const el of HERR) { el.hidden = false; caixa.append(el); }
      pintarFerramentas();
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
    // tudo vem cifrado de conteudo/ (o grátis com a chave pública de D.livres): não existe PDF solto pra baixar
    const reg = m.gratis ? D.livres[m.id] : acesso.archivos[m.id];
    const resp = await fetch(`conteudo/${reg.arq}`);
    if (!resp.ok) throw new Error('rede');
    const buf = new Uint8Array(await resp.arrayBuffer());
    const chave = await crypto.subtle.importKey('raw', b64(reg.chave), 'AES-GCM', false, ['decrypt']);
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf.slice(0, 12) }, chave, buf.slice(12));
    planos.set(m.id, plano);
    return plano;
  }

  let L = null; // leitor aberto: { m, doc, obs, render:Set }
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
    history.pushState({ leitor: m.id }, '');
    $('leitorVolver').focus();
    const atual = (L = { m, render: new Set() });
    const tentar = async () => {
      estadoLeitor('Abriendo tu material...');
      try {
        const [pdfjs, plano] = await Promise.all([carregarPdfjs(), baixarPdf(m)]);
        if (L !== atual) return;
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

  /* ---------- só no site: o material não se baixa nem se imprime ---------- */
  // segurar o dedo ou o botão direito nas páginas e nos vídeos não abre "salvar imagem"
  document.addEventListener('contextmenu', (e) => { if (e.target.closest('#leitor, .cine, .livro, .video')) e.preventDefault(); });
  document.addEventListener('dragstart', (e) => { if (e.target.closest('#leitor, .cine')) e.preventDefault(); });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['s', 'p'].includes(e.key.toLowerCase())) { e.preventDefault(); avisar('Tu material se ve aquí mismo, en esta página.'); }
  });

  /* ---------- início: quem já entrou neste celular volta direto ---------- */
  (async () => {
    desenhar(false);
    const pediuReto = location.hash === '#reto';
    if (pediuReto) history.replaceState(null, '', location.pathname + location.search);
    const irAoReto = () => { if (pediuReto && acesso) requestAnimationFrame(() => $('reto').scrollIntoView({ block: 'start' })); };
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
        irAoReto();
        return;
      }
      $('claveAviso').textContent = 'Ese enlace no abrió nada. Escribe aquí la clave que te llegó con tu compra.';
      $('claveAviso').classList.add('erro');
    }
    const salva = guardar.ler(CHAVE_LOCAL);
    if (!salva) return;
    let r = null;
    try { r = await abrirCofre(salva); } catch { r = null; }
    if (r) { acesso = r; desenhar(false); irAoReto(); } else guardar.tirar(CHAVE_LOCAL);
  })();
})();
