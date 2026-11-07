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
      <p>Donde el video pone azúcar, usa endulzante de fruta del monje: no amarga ni deja sabor raro.</p>
      <ul>
        <li><b>Lakanto Clásico</b> va 1 a 1: la misma medida que el azúcar.</li>
        <li><b>Monkiä en sobre</b>: 1 sobre por cada 2 cucharaditas de azúcar.</li>
        <li>Si lleva <b>leche condensada</b>, usa 1 lata de leche evaporada con 3 cucharadas de Lakanto.</li>
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
