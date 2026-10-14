const grades = [
  { id: 'kg', title: 'رياض الأطفال', short: 'KG', subtitle: 'روضة الملائكة', icon: '✿', description: 'بدايتنا مع التسبيح والتعلّم بمحبة.' },
  { id: 'g12', title: 'الصفان الأول والثاني', short: '١–٢', subtitle: 'المرحلة الأولى', icon: '✎', description: 'خطوات أولى في الألحان واللغة والطقس.' },
  { id: 'g34', title: 'الصفان الثالث والرابع', short: '٣–٤', subtitle: 'المرحلة الثانية', icon: '♫', description: 'نتدرّب على المعرفة والترتيل والخدمة.' },
  { id: 'g56', title: 'الصفان الخامس والسادس', short: '٥–٦', subtitle: 'المرحلة الثالثة', icon: '✦', description: 'نعمّق فهمنا ونوسّع مكتبتنا التعليمية.' },
  { id: 'middle', title: 'المرحلة الإعدادية', short: 'إعدادي', subtitle: 'المرحلة الإعدادية', icon: '⌘', description: 'مواد تناسب مرحلة النمو والمسؤولية.' },
  { id: 'high', title: 'المرحلة الثانوية', short: 'ثانوي', subtitle: 'المرحلة الثانوية', icon: '✥', description: 'استعداد أعمق للخدمة والمعرفة الكنسية.' },
  { id: 'choir', title: 'خورس الشمامسة', short: 'الخورس', subtitle: 'الخريجون والمستويات المتقدمة', icon: '♬', description: 'مواد متقدمة لخدمة الخورس والترتيل.' }
];

const subjects = [
  { id: 'hymns', title: 'الألحان', icon: '♫', description: 'ألحان الكنيسة وتسابيحها مع مواد الاستماع والتدريب.' },
  { id: 'coptic', title: 'اللغة القبطية', icon: 'ⲙ', description: 'دروس الحروف والكلمات والقراءات باللغة القبطية.' },
  { id: 'liturgy', title: 'الطقس الكنسي', icon: '✧', description: 'شرح مبسّط للطقوس والخدمة الكنسية.' }
];

const terms = [
  { id: 'term-1', title: 'الفصل الدراسي الأول', numeral: '١', description: 'مواد ودروس الفصل الأول' },
  { id: 'term-2', title: 'الفصل الدراسي الثاني', numeral: '٢', description: 'مواد ودروس الفصل الثاني' },
  { id: 'term-3', title: 'الفصل الدراسي الثالث', numeral: '٣', description: 'مواد ودروس الفصل الثالث' }
];

const announcements = [
  { type: 'إعلان تعريفي', title: 'مرحبًا بكم في مكتبة Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', text: 'مساحة تعليمية تجمع مواد الألحان واللغة القبطية والطقس الكنسي، مرتبة حسب المرحلة والفصل الدراسي.' },
  { type: 'دليل الاستخدام', title: 'تصفّح المواد حسب مرحلتك الدراسية', text: 'اختر المرحلة، ثم المادة والفصل الدراسي للوصول إلى الدروس والملفات المتاحة.' },
  { type: 'ميزة التطبيق', title: 'أضف التطبيق إلى شاشة جهازك', text: 'يمكن تثبيت هذه المكتبة من المتصفح للوصول إليها بسهولة على الهاتف أو الكمبيوتر.' }
];

const app = document.getElementById('app');
const dbName = 'archangelos-school-content';
const storeName = 'resources';
let database;
let records = [];
let editId = null;
let installPrompt = null;
let toastTimer;
let currentLocale = window.__archangelosLocale || 'en';
let storageMode = 'unavailable';
let csrfToken = '';
let adminUsername = '';
let knownResourceIds = new Set();
const objectUrls = new Map();
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
const deviceLocale = () => {
  const language = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
  return language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};

function themeLabel(choice) {
  const labels = currentLocale === 'en'
    ? { system: 'System', light: 'Light', dark: 'Dark' }
    : { system: 'حسب الجهاز', light: 'فاتح', dark: 'داكن' };
  return labels[choice] || labels.system;
}

function themeIcon(choice) {
  return ({ system: '◐', light: '☀', dark: '☾' })[choice] || '◐';
}

function setTheme(choice, save = false) {
  if (!['system', 'light', 'dark'].includes(choice)) choice = 'system';
  if (save) {
    try { localStorage.setItem('archangelos-theme', choice); } catch (_) {}
  }
  const dark = choice === 'dark' || (choice === 'system' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.themeChoice = choice;
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171514' : '#710d19';
  document.getElementById('themeCurrentIcon').textContent = themeIcon(choice);
  document.getElementById('themeCurrentLabel').textContent = themeLabel(choice);
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  });
}

function closeThemeMenu(restoreFocus = false) {
  document.getElementById('themeMenu').hidden = true;
  document.getElementById('themeToggle').setAttribute('aria-expanded', 'false');
  if (restoreFocus) document.getElementById('themeToggle').focus();
}

function refreshLanguageSwitch() {
  const button = document.getElementById('languageSwitch');
  if (!button) return;
  const switchToEnglish = currentLocale === 'ar';
  button.textContent = switchToEnglish ? 'English' : 'العربية';
  button.setAttribute('aria-label', switchToEnglish ? 'التبديل إلى اللغة الإنجليزية' : 'Switch app language to Arabic');
}

function localizeDom(root) {
  if (!window.ArchangelosI18n || !root) return;
  const translate = (value) => window.ArchangelosI18n.translate(value, currentLocale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue.trim() || node.parentElement?.closest('[data-no-translate]')) continue;
    if (node.__localeSource === undefined) node.__localeSource = node.nodeValue;
    node.nodeValue = translate(node.__localeSource);
  }
  const elements = [root, ...root.querySelectorAll('*')];
  for (const element of elements) {
    if (element.closest?.('[data-no-translate]')) continue;
    element.__localeAttributes ||= {};
    for (const name of ['aria-label', 'alt', 'title', 'placeholder']) {
      if (!element.hasAttribute(name)) continue;
      if (element.__localeAttributes[name] === undefined) element.__localeAttributes[name] = element.getAttribute(name);
      element.setAttribute(name, translate(element.__localeAttributes[name]));
    }
  }
}

function setLocale(choice, save = false, refresh = true) {
  if (!['system', 'ar', 'en'].includes(choice)) choice = 'system';
  if (save) {
    try { localStorage.setItem('archangelos-locale', choice); } catch (_) {}
  }
  currentLocale = choice === 'system' ? deviceLocale() : choice;
  document.documentElement.dataset.localeChoice = choice;
  document.documentElement.lang = currentLocale;
  document.documentElement.dir = currentLocale === 'ar' ? 'rtl' : 'ltr';
  window.__archangelosLocale = currentLocale;
  document.title = currentLocale === 'ar' ? 'مدرسة أرشى أنجيلوس للشمامسة' : 'Archangelos School of Deacons';
  document.querySelector('meta[name="description"]').content = currentLocale === 'ar'
    ? 'مدرسة أرشى أنجيلوس للشمامسة — مكتبة الألحان واللغة القبطية والطقس لجميع المراحل.'
    : 'Archangelos School of Deacons — a learning library for hymns, Coptic, and church liturgy.';
  document.querySelector('meta[name="apple-mobile-web-app-title"]').content = currentLocale === 'ar' ? 'أرشى أنجيلوس' : 'Archangelos';
  document.getElementById('footerName').textContent = currentLocale === 'ar' ? 'مدرسة أرشى أنجيلوس للشمامسة' : 'Archangelos School of Deacons';
  const manifest = document.getElementById('appManifest');
  if (manifest) manifest.href = `manifest-${currentLocale}.json`;
  document.querySelectorAll('[data-locale-choice]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.localeChoice === choice));
  });
  document.getElementById('themeCurrentLabel').textContent = themeLabel(document.documentElement.dataset.themeChoice || 'system');
  localizeDom(document.body);
  setTheme(document.documentElement.dataset.themeChoice || 'system');
  refreshNotificationControl();
  refreshLanguageSwitch();
  if (refresh) render();
}

setTheme(document.documentElement.dataset.themeChoice || 'system');
setLocale(document.documentElement.dataset.localeChoice || 'system', false, false);

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

function currentRoute() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  return raw.startsWith('/') ? raw : `/${raw}`;
}

function go(route) {
  location.hash = route;
}

function iconFor(type) {
  return ({ audio: '♫', video: '▶', pdf: '▤', image: '▧' })[type] || '▤';
}

function typeName(type) {
  return ({ audio: 'ملف صوتي', video: 'فيديو', pdf: 'مستند PDF', image: 'صورة' })[type] || 'مادة';
}

function typeNameEnglish(type) {
  return ({ audio: 'audio file', video: 'video', pdf: 'PDF', image: 'image' })[type] || 'material';
}

function localizedNewMaterialMessage(record) {
  return currentLocale === 'ar'
    ? `تم رفع ${typeName(record.type)} ${record.type === 'image' ? 'جديدة' : 'جديد'}: ${record.title}`
    : `New ${typeNameEnglish(record.type)} uploaded: ${record.title}`;
}

function refreshNotificationControl() {
  const button = document.getElementById('notificationToggle');
  const status = document.getElementById('notificationStatus');
  if (!button || !status) return;
  let message = 'فعّل إشعارات المواد الجديدة';
  let disabled = false;
  if (!('Notification' in window)) {
    message = 'الإشعارات غير مدعومة في هذا المتصفح';
    disabled = true;
  } else if (!window.isSecureContext) {
    message = 'إشعارات المتصفح تحتاج إلى اتصال آمن (HTTPS).';
    disabled = true;
  } else if (Notification.permission === 'granted') {
    message = 'إشعارات المحتوى مفعّلة';
  } else if (Notification.permission === 'denied') {
    message = 'إشعارات المتصفح محظورة. غيّر الإذن من إعدادات المتصفح.';
  }
  status.textContent = window.ArchangelosI18n ? window.ArchangelosI18n.translate(message, currentLocale) : message;
  button.disabled = disabled;
  button.setAttribute('aria-pressed', String('Notification' in window && Notification.permission === 'granted'));
  button.setAttribute('aria-label', status.textContent);
}

async function enableNotifications() {
  if (!('Notification' in window)) {
    announceToast('الإشعارات غير مدعومة في هذا المتصفح');
    return;
  }
  if (!window.isSecureContext) {
    announceToast('إشعارات المتصفح تحتاج إلى اتصال آمن (HTTPS).');
    return;
  }
  if (Notification.permission === 'denied') {
    announceToast('إشعارات المتصفح محظورة. غيّر الإذن من إعدادات المتصفح.');
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    refreshNotificationControl();
    announceToast(permission === 'granted' ? 'تم تفعيل إشعارات المحتوى الجديد.' : 'تعذّر تفعيل الإشعارات في هذا المتصفح.');
  } catch (error) {
    refreshNotificationControl();
    announceToast('تعذّر تفعيل الإشعارات في هذا المتصفح.');
  }
}

async function notifyNewMaterial(record) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || !window.isSecureContext) return;
  const title = currentLocale === 'ar' ? 'مادة جديدة في مدرسة أرشى أنجيلوس' : 'New material at Archangelos School of Deacons';
  const url = new URL('./', window.location.href);
  url.hash = `/grade/${encodeURIComponent(record.gradeId)}/${encodeURIComponent(record.subjectId)}/${encodeURIComponent(record.termId)}`;
  const options = {
    body: localizedNewMaterialMessage(record),
    icon: 'assets/icons/icon-192.png',
    badge: 'assets/icons/favicon-64.png',
    tag: `new-material-${record.id}`,
    renotify: true,
    data: { url: url.href }
  };
  try {
    let registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration && !registration.active) registration = await navigator.serviceWorker.ready;
    if (registration && 'showNotification' in registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch (error) {
    console.warn('Could not show a new-material notification', error);
  }
}

function gradeById(id) { return grades.find((item) => item.id === id); }
function subjectById(id) { return subjects.find((item) => item.id === id); }
function termById(id) { return terms.find((item) => item.id === id); }
function resourcesFor(gradeId, subjectId, termId) {
  return records.filter((record) => record.gradeId === gradeId && record.subjectId === subjectId && record.termId === termId);
}
function countFor(gradeId, subjectId, termId) {
  return resourcesFor(gradeId, subjectId, termId).length;
}

function announceToast(message, translate = true) {
  const toast = document.getElementById('toast');
  toast.textContent = translate && window.ArchangelosI18n ? window.ArchangelosI18n.translate(message, currentLocale) : message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('المتصفح لا يدعم قاعدة بيانات المحتوى.'));
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('تعذّر فتح قاعدة البيانات.'));
  });
}

function readAllRecords() {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function apiEndpoint(path) {
  return new URL(path, document.baseURI).toString();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiEndpoint(path), {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options
  });
  const contentType = response.headers.get('Content-Type') || '';
  const result = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(result?.error || `Server request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return result;
}

async function connectSharedServer() {
  const [session, sharedRecords] = await Promise.all([
    apiRequest('./api/session'),
    apiRequest('./api/resources')
  ]);
  storageMode = 'server';
  csrfToken = session.csrfToken || '';
  adminUsername = session.authenticated ? session.username : '';
  records = sharedRecords;
  knownResourceIds = new Set(records.map((record) => record.id));
  refreshObjectUrls();
}

async function syncSharedResources() {
  if (storageMode !== 'server' || document.visibilityState === 'hidden') return;
  try {
    const latest = await apiRequest('./api/resources');
    const newRecords = latest.filter((record) => !knownResourceIds.has(record.id));
    const changed = latest.length !== records.length || latest.some((record) => {
      const previous = records.find((item) => item.id === record.id);
      return !previous || previous.updatedAt !== record.updatedAt;
    });
    knownResourceIds = new Set(latest.map((record) => record.id));
    if (!changed) return;
    records = latest;
    refreshObjectUrls();
    if (!editId) {
      const scrollPosition = window.scrollY;
      render();
      window.scrollTo({ top: scrollPosition, behavior: 'auto' });
    }
    if (newRecords.length) {
      announceToast(localizedNewMaterialMessage(newRecords[0]), false);
      newRecords.forEach(notifyNewMaterial);
    }
  } catch (error) {
    console.warn('Could not refresh shared materials', error);
  }
}

function writeRecord(record) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function removeRecord(id) {
  return new Promise((resolve, reject) => {
    const request = database.transaction(storeName, 'readwrite').objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function refreshObjectUrls() {
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
  for (const record of records) {
    if (record.mediaBlob instanceof Blob) objectUrls.set(record.id, URL.createObjectURL(record.mediaBlob));
  }
}

function mediaUrl(record) {
  if (record.mediaBlob instanceof Blob) return objectUrls.get(record.id) || '';
  if (record.fileUrl) return /^\.\/uploads\/[a-f0-9]{32}\.[a-z0-9]{1,8}$/i.test(record.fileUrl) ? record.fileUrl : '';
  return safeExternalUrl(record.url);
}

function safeExternalUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function youtubeEmbed(value) {
  const safe = safeExternalUrl(value);
  if (!safe) return '';
  try {
    const url = new URL(safe);
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0] || '';
    else if (url.hostname === 'youtube.com' || url.hostname.endsWith('.youtube.com')) id = url.searchParams.get('v') || url.pathname.match(/\/(?:embed|shorts)\/([^/?]+)/)?.[1] || '';
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
  } catch { return ''; }
}

function routeLink(route, label, className = '') {
  return `<a class="${className}" href="#${route}">${label}</a>`;
}

function bread(items) {
  return `<div class="breadcrumbs">${items.map((item, index) => `${index ? '<span>‹</span>' : ''}${item.href ? `<a href="#${item.href}">${esc(item.label)}</a>` : `<b>${esc(item.label)}</b>`}`).join('')}</div>`;
}

function pageBanner(title, subtitle, crumbs) {
  return `<section class="page-banner"><div class="container">${bread(crumbs)}<div class="page-heading"><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div></div></section>`;
}

function renderHome() {
  const gradeCards = grades.map((grade) => `
    <a class="grade-card" href="#/grade/${grade.id}">
      <span class="grade-icon" aria-hidden="true">${grade.icon}</span>
      <span class="grade-card-copy"><h3>${esc(grade.title)}</h3><p>${esc(grade.subtitle)}</p></span>
      <span class="arrow" aria-hidden="true">←</span>
    </a>`).join('');
  return `
    <section class="hero">
      <div class="container hero-grid">
        <div class="hero-copy">
          <div class="hero-kicker"><span>✦</span> نرتّل ونتعلّم ونخدم</div>
          <h1>في رحاب الكنيسة،<br><em>يكبر صوت الخدمة</em></h1>
          <p>مرحبًا بكم في Archangelos School of Deacons (مدرسة أرشى أنجيلوس للشمامسة)؛ مكتبة تعليمية تجمع الألحان واللغة القبطية والطقس الكنسي، في رحلة تناسب كل مرحلة.</p>
          <div class="hero-actions"><a class="button button-primary" href="#/grades">اكتشف المراحل <span aria-hidden="true">←</span></a><a class="button button-outline" href="#/about">تعرّف على المدرسة</a></div>
          <div class="hero-meta"><span><b>✓</b> لجميع الأعمار والمراحل</span><span><b>✓</b> مواد سهلة الوصول</span></div>
        </div>
        <div class="hero-art" aria-label="شعار مدرسة أرشى أنجيلوس للشمامسة"><span class="art-stamp stamp-one" aria-hidden="true">✦</span><span class="art-stamp stamp-two" aria-hidden="true">♫</span><div class="logo-frame"><img src="./logo.png" data-school-logo alt="شعار مدرسة أرشى أنجيلوس للشمامسة"></div></div>
      </div>
    </section>
    <div class="quick-strip" aria-label="محتويات المكتبة">
      <div class="quick-item"><span class="quick-icon" aria-hidden="true">♫</span><span><strong>الألحان</strong><small>تعلّم واستمع ورتّل</small></span></div>
      <div class="quick-item"><span class="quick-icon" aria-hidden="true">ⲙ</span><span><strong>اللغة القبطية</strong><small>حروف وكلمات وقراءات</small></span></div>
      <div class="quick-item"><span class="quick-icon" aria-hidden="true">✧</span><span><strong>الطقس الكنسي</strong><small>افهم ترتيب الخدمة</small></span></div>
    </div>
    <section class="section container" id="grades">
      <div class="section-heading"><div><span class="eyebrow">مسارك التعليمي</span><h2>اختر مرحلتك الدراسية</h2><p>لكل مرحلة مواد مرتبة حسب المادة والفصل الدراسي.</p></div>${routeLink('/grades','كل المراحل ←','button button-soft button-small')}</div>
      <div class="grade-grid">${gradeCards}</div>
    </section>
    <section class="section container section-tight">
      <div class="section-heading"><div><span class="eyebrow">من أخبار المدرسة</span><h2>إعلانات وإرشادات</h2><p>كل ما يساعدك على استخدام المكتبة ومتابعة موادها.</p></div>${routeLink('/announcements','عرض الكل ←','button button-outline button-small')}</div>
      ${renderAnnouncementHighlights()}
    </section>`;
}

function renderAnnouncementHighlights() {
  const [first, ...rest] = announcements;
  return `<div class="announcement-layout">
    <article class="announcement-feature"><span class="eyebrow">${esc(first.type)}</span><h3>${esc(first.title)}</h3><p>${esc(first.text)}</p><span class="date">مرحبًا بكم</span></article>
    <div class="announcement-side">${rest.map((item) => `<article class="announcement-mini"><span class="date">${esc(item.type)}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join('')}</div>
  </div>`;
}

function renderGrades() {
  return `${pageBanner('المراحل الدراسية','اختر المرحلة لعرض المواد والفصول المتاحة.',[{ label: 'الرئيسية', href: '/' },{ label: 'المراحل الدراسية' }])}<section class="section container"><div class="grade-grid">${grades.map((grade) => `<a class="grade-card" href="#/grade/${grade.id}"><span class="grade-icon">${grade.icon}</span><span class="grade-card-copy"><h3>${esc(grade.title)}</h3><p>${esc(grade.description)}</p></span><span class="arrow">←</span></a>`).join('')}</div></section>`;
}

function renderGrade(grade) {
  if (!grade) return renderNotFound();
  return `${pageBanner(grade.title,grade.description,[{ label: 'الرئيسية', href: '/' },{ label: 'المراحل الدراسية', href: '/grades' },{ label: grade.title }])}<section class="section container"><div class="section-heading"><div><span class="eyebrow">المواد الدراسية</span><h2>اختر مادة للمتابعة</h2><p>تظهر مواد الفصل الدراسي داخل كل مادة.</p></div></div><div class="subject-grid">${subjects.map((subject) => {
    const total = terms.reduce((sum, term) => sum + countFor(grade.id, subject.id, term.id), 0);
    return `<a class="subject-card" href="#/grade/${grade.id}/${subject.id}"><div class="subject-card-top"><span class="subject-icon">${subject.icon}</span><span class="subject-arrow">←</span></div><h3>${esc(subject.title)}</h3><p>${esc(subject.description)}</p><div class="card-foot"><span>ثلاثة فصول دراسية</span><span>${total ? `${total} مادة` : 'ابدأ التصفّح'}</span></div></a>`;
  }).join('')}</div></section>`;
}

function renderSubject(grade, subject) {
  if (!grade || !subject) return renderNotFound();
  return `${pageBanner(subject.title,`${grade.title} · ${subject.description}`,[{ label: 'الرئيسية', href: '/' },{ label: grade.title, href: `/grade/${grade.id}` },{ label: subject.title }])}<section class="section container"><div class="section-heading"><div><span class="eyebrow">تقسيم المحتوى</span><h2>اختر الفصل الدراسي</h2><p>افتح الفصل لعرض الدروس والملفات المضافة إليه.</p></div></div><div class="term-grid">${terms.map((term) => {
    const total = countFor(grade.id, subject.id, term.id);
    return `<a class="term-card" href="#/grade/${grade.id}/${subject.id}/${term.id}"><span class="term-number">${term.numeral}</span><span><h3>${esc(term.title)}</h3><p>${total ? `${total} مادة تعليمية` : 'لم تُضف مواد بعد'}</p></span><span class="term-chevron">←</span></a>`;
  }).join('')}</div></section>`;
}

function renderResource(record) {
  const src = mediaUrl(record);
  const isYoutube = record.type === 'video' && !record.mediaBlob && youtubeEmbed(record.url);
  const external = record.url ? safeExternalUrl(record.url) : '';
  let player = '';
  if (src && record.type === 'audio') player = `<div class="media-frame"><audio controls preload="metadata" src="${esc(src)}">المتصفح لا يدعم تشغيل الصوت.</audio></div>`;
  if (src && record.type === 'video' && isYoutube) player = `<div class="media-frame"><iframe src="${esc(isYoutube)}" title="${esc(record.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  else if (src && record.type === 'video') player = `<div class="media-frame"><video controls preload="metadata" src="${esc(src)}">المتصفح لا يدعم تشغيل الفيديو.</video></div>`;
  if (src && record.type === 'pdf') player = `<div class="media-frame pdf-frame"><iframe src="${esc(src)}#toolbar=1" title="${esc(record.title)}" loading="lazy"></iframe></div>`;
  if (src && record.type === 'image') player = `<div class="media-frame"><img src="${esc(src)}" alt="${esc(record.title)}" loading="lazy"></div>`;
  const downloadable = src || external;
  return `<article class="resource-card resource-type-${esc(record.type)}"><div class="resource-head"><span class="resource-type-icon" aria-hidden="true">${iconFor(record.type)}</span><div class="resource-head-copy"><h3 data-no-translate>${esc(record.title)}</h3><p>${typeName(record.type)}</p></div></div>${record.description ? `<p class="resource-description" data-no-translate>${esc(record.description)}</p>` : ''}${player}${downloadable ? `<div class="resource-actions"><a class="button button-outline button-small" href="${esc(downloadable)}" ${record.mediaBlob ? 'download' : 'target="_blank" rel="noopener"'}>فتح / تنزيل المادة <span aria-hidden="true">↗</span></a></div>` : ''}</article>`;
}

function renderTerm(grade, subject, term) {
  if (!grade || !subject || !term) return renderNotFound();
  const list = resourcesFor(grade.id, subject.id, term.id);
  const items = list.length ? `<div class="resource-grid">${list.map(renderResource).join('')}</div>` : `<div class="empty-state"><div class="empty-illustration" aria-hidden="true">♫</div><h3>المكتبة تستعد لاستقبال مواد هذا الفصل</h3><p>لم تتم إضافة مواد إلى هذا القسم بعد. يمكن للمسؤول إضافة تسجيلات صوتية أو فيديوهات أو ملفات PDF أو صور من لوحة إدارة المحتوى.</p><a class="button button-primary" href="#/admin">إدارة المحتوى</a></div>`;
  return `${pageBanner(term.title,`${grade.title} · ${subject.title}`,[{ label: 'الرئيسية', href: '/' },{ label: grade.title, href: `/grade/${grade.id}` },{ label: subject.title, href: `/grade/${grade.id}/${subject.id}` },{ label: term.title }])}<section class="section container"><div class="resource-toolbar"><span class="resource-count">${list.length ? `${list.length} مادة تعليمية` : 'لا توجد مواد منشورة بعد'}</span><a class="button button-soft button-small" href="#/admin">＋ إضافة مادة</a></div>${items}</section>`;
}

function renderAnnouncements() {
  return `${pageBanner('الإعلانات والإرشادات','رسائل تساعدك على التعرّف إلى المكتبة واستخدامها.',[{ label: 'الرئيسية', href: '/' },{ label: 'الإعلانات' }])}<section class="section container"><div class="announcement-list">${announcements.map((item) => `<article class="announcement-row"><time>${esc(item.type)}</time><div><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></div></article>`).join('')}</div><div class="notice-box" style="margin-top:18px"><span>✦</span><div><strong>تنويه</strong>هذه الإعلانات إرشادية افتراضية في النسخة الأولية. أضف الأخبار الفعلية عند ربط الموقع بمصدر إدارة المدرسة.</div></div></section>`;
}

function renderAbout() {
  return `${pageBanner('عن المدرسة','Archangelos School of Deacons · مدرسة أرشى أنجيلوس للشمامسة', [{ label: 'الرئيسية', href: '/' },{ label: 'عن المدرسة' }])}<section class="section container"><div class="about-grid"><div class="about-mark"><img src="./logo.png" data-school-logo alt="شعار مدرسة أرشى أنجيلوس للشمامسة"></div><div class="about-copy"><span class="eyebrow">نتعلّم بمحبة</span><h2>نتعلّم ونرتّل ونخدم</h2><p>مدرسة أرشى أنجيلوس للشمامسة (Archangelos School of Deacons) مساحة تعليمية تساعد الطلاب على التدرّج في تعلّم الألحان واللغة القبطية والطقس الكنسي، من رياض الأطفال حتى خورس الشمامسة.</p><p>صُممت المكتبة لتكون واضحة على الهاتف والكمبيوتر، وتجمع مواد كل مرحلة في مكان واحد، مع إمكان تثبيت التطبيق والرجوع إلى المواد المحفوظة دون اتصال.</p><div class="about-values"><div class="about-value"><span>♫</span> تعلّم الألحان بالتدرّج والاستماع</div><div class="about-value"><span>ⲙ</span> التعرّف إلى اللغة القبطية</div><div class="about-value"><span>✧</span> فهم الطقس والخدمة الكنسية</div></div></div></div></section>`;
}

function monitorLogoImages(root = document) {
  root.querySelectorAll('img[data-school-logo]').forEach((image) => {
    if (image.dataset.logoErrorListenerAttached === 'true') return;
    image.dataset.logoErrorListenerAttached = 'true';
    const reportFailure = () => {
      const failedSource = image.currentSrc || image.src;
      const fallback = new URL('./assets/logo.png', document.baseURI).href;
      if (image.dataset.logoFallbackAttempted !== 'true' && new URL(image.src, document.baseURI).href !== fallback) {
        image.dataset.logoFallbackAttempted = 'true';
        console.error('Archangelos logo failed to load; retrying the existing asset copy:', failedSource);
        image.src = fallback;
        return;
      }
      if (image.dataset.logoErrorReported === 'true') return;
      image.dataset.logoErrorReported = 'true';
      console.error('Archangelos logo failed to load:', failedSource);
    };
    image.addEventListener('error', reportFailure);
    if (image.complete && image.naturalWidth === 0) reportFailure();
  });
}

function adminFormMarkup() {
  const selected = (value, current) => value === current ? 'selected' : '';
  const record = records.find((item) => item.id === editId);
  return `<section class="admin-panel"><h2>${record ? 'تعديل المادة' : 'إضافة مادة تعليمية'}</h2><p>أضف ملفًا من جهازك أو رابط فيديو. تحفظ المواد على الخادم المشترك.</p><form class="admin-form" id="resourceForm">
    <div class="form-field"><label for="resourceTitle">عنوان المادة</label><input id="resourceTitle" name="title" required maxlength="100" value="${esc(record?.title || '')}" placeholder="مثال: لحن تين أوأوشت"></div>
    <div class="form-grid"><div class="form-field"><label for="resourceGrade">المرحلة</label><select id="resourceGrade" name="gradeId" required><option value="" disabled ${record ? '' : 'selected'}>اختر المرحلة</option>${grades.map((grade) => `<option value="${grade.id}" ${selected(grade.id,record?.gradeId)}>${esc(grade.title)}</option>`).join('')}</select></div><div class="form-field"><label for="resourceSubject">المادة</label><select id="resourceSubject" name="subjectId" required><option value="" disabled ${record ? '' : 'selected'}>اختر المادة</option>${subjects.map((subject) => `<option value="${subject.id}" ${selected(subject.id,record?.subjectId)}>${esc(subject.title)}</option>`).join('')}</select></div></div>
    <div class="form-grid"><div class="form-field"><label for="resourceTerm">الفصل الدراسي</label><select id="resourceTerm" name="termId" required><option value="" disabled ${record ? '' : 'selected'}>اختر الفصل الدراسي</option>${terms.map((term) => `<option value="${term.id}" ${selected(term.id,record?.termId)}>${esc(term.title)}</option>`).join('')}</select></div><div class="form-field"><label for="resourceType">نوع المحتوى</label><select id="resourceType" name="type" required><option value="" disabled ${record ? '' : 'selected'}>اختر نوع المحتوى</option>${['audio','video','pdf','image'].map((type) => `<option value="${type}" ${selected(type,record?.type)}>${typeName(type)}</option>`).join('')}</select></div></div>
    <div class="form-field"><label for="resourceDescription">وصف مختصر</label><textarea id="resourceDescription" name="description" maxlength="4000" placeholder="أضف شرحًا يساعد الطالب على الاستفادة من المادة">${esc(record?.description || '')}</textarea></div>
    <div class="form-field"><label for="resourceFile">رفع ملف من الجهاز</label><input id="resourceFile" name="file" type="file" accept="audio/*,video/*,application/pdf,image/*"><span class="form-hint">${record?.mediaBlob || record?.fileUrl ? 'توجد نسخة مرفوعة. اختر ملفًا جديدًا لاستبدالها.' : 'للملفات الكبيرة، استخدم رابطًا مباشرًا أو رابط YouTube.'}</span></div>
    <div class="form-field"><label for="resourceUrl">أو رابط مباشر / YouTube</label><input id="resourceUrl" name="url" type="url" dir="ltr" value="${esc(record?.url || '')}" placeholder="https://..."><span class="form-hint">روابط YouTube تُعرض داخل مشغّل الفيديو. أضف رابطًا مباشرًا لملف صوت أو PDF أو صورة عند الحاجة.</span></div>
    <div class="form-actions"><button class="button button-primary" type="submit">${record ? 'حفظ التعديلات' : 'إضافة إلى المكتبة'}</button>${record ? '<button class="button button-outline" type="button" id="cancelEdit">إلغاء التعديل</button>' : ''}</div>
  </form></section>`;
}

function renderAdminLogin() {
  return `${pageBanner('دخول المسؤول','سجّل الدخول لإدارة مكتبة المدرسة المشتركة.',[{ label: 'الرئيسية', href: '/' },{ label: 'إدارة المحتوى' }])}<section class="section container"><section class="admin-panel" style="max-width:520px;margin-inline:auto"><h2>دخول المسؤول</h2><p>المواد المنشورة متاحة للطلاب، وتحتاج إضافة المواد أو تعديلها إلى حساب مسؤول.</p><form class="admin-form" id="adminLoginForm"><div class="form-field"><label for="adminUsername">اسم المستخدم</label><input id="adminUsername" name="username" autocomplete="username" required maxlength="80" dir="ltr"></div><div class="form-field"><label for="adminPassword">كلمة المرور</label><input id="adminPassword" name="password" type="password" autocomplete="current-password" required dir="ltr"></div><div class="form-actions"><button class="button button-primary" type="submit">تسجيل الدخول</button></div></form></section></section>`;
}

function renderAdmin() {
  if (storageMode === 'unavailable') {
    return `${pageBanner('الخادم المشترك غير متاح','تعذّر الاتصال بخادم المحتوى.',[{ label: 'الرئيسية', href: '/' },{ label: 'إدارة المحتوى' }])}<section class="section container"><div class="notice-box"><span>ⓘ</span><div><strong>تعذّر الاتصال بالخادم</strong>شغّل <code>python server.py</code> من مجلد التطبيق، ثم افتح <code>http://localhost:8000</code> لإدارة المحتوى ومزامنته بين الأجهزة. لا تُحفظ التغييرات أثناء انقطاع الخادم.</div></div><button class="button button-primary" id="retryServer" type="button" style="margin-top:16px">إعادة المحاولة</button></section>`;
  }
  if (storageMode === 'server' && !adminUsername) return renderAdminLogin();
  const list = records.length ? records.map((record) => {
    const grade = gradeById(record.gradeId);
    const subject = subjectById(record.subjectId);
    const term = termById(record.termId);
    const viewUrl = mediaUrl(record);
    return `<div class="admin-resource resource-type-${esc(record.type)}"><span class="resource-type-icon" aria-hidden="true">${iconFor(record.type)}</span><div class="admin-resource-copy"><strong data-no-translate>${esc(record.title)}</strong><small>${esc(grade?.title || '')} · ${esc(subject?.title || '')} · ${esc(term?.title || '')}</small></div><div class="admin-resource-actions">${viewUrl ? `<a class="button button-soft button-small" href="${esc(viewUrl)}" target="_blank" rel="noopener">عرض</a>` : ''}<button class="button button-outline button-small" type="button" data-edit="${esc(record.id)}">تعديل</button><button class="button button-danger button-small" type="button" data-delete="${esc(record.id)}">حذف</button></div></div>`;
  }).join('') : '<div class="admin-empty">لم تُضف أي مواد بعد. أضف أول مادة من النموذج.</div>';
  const storageNotice = storageMode === 'server'
    ? `<div class="notice-box" style="margin-bottom:18px"><span>✓</span><div><strong>التخزين المشترك متصل</strong>تُحفظ الملفات والمواد على خادم المدرسة، وتظهر لكل المستخدمين والأجهزة.</div><button class="button button-outline button-small" id="adminLogout" type="button">تسجيل الخروج · ${esc(adminUsername)}</button></div>`
    : `<div class="notice-box" style="margin-bottom:18px"><span>ⓘ</span><div><strong>وضع معاينة محلي</strong>أنت تفتح الملف مباشرة؛ التغييرات هنا تخص هذا المتصفح فقط. للتخزين المشترك شغّل الخادم وافتح التطبيق عبر <code>http://localhost:8000</code>.</div></div>`;
  return `${pageBanner('إدارة المحتوى','أضف مواد كل مرحلة ومادة وفصل دراسي.',[{ label: 'الرئيسية', href: '/' },{ label: 'إدارة المحتوى' }])}<section class="section container">${storageNotice}<div class="admin-layout">${adminFormMarkup()}<section class="admin-panel"><h2>المواد المضافة <span class="resource-count">(${records.length})</span></h2><p>يمكنك تعديل المواد وحذفها من هذه القائمة.</p><div class="admin-list">${list}</div></section></div></section>`;
}

function renderNotFound() {
  return `${pageBanner('لم نعثر على هذا القسم','قد يكون الرابط غير صحيح أو أن القسم لم يعد متاحًا.',[{ label: 'الرئيسية', href: '/' }])}<section class="section container"><div class="empty-state"><div class="empty-illustration">✦</div><h3>لنعد إلى الصفحة الرئيسية</h3><a class="button button-primary" href="#/">العودة للرئيسية</a></div></section>`;
}

function render() {
  const route = currentRoute().split('/').filter(Boolean);
  if (route.length === 0) app.innerHTML = renderHome();
  else if (route[0] === 'grades') app.innerHTML = renderGrades();
  else if (route[0] === 'grade' && route.length === 2) app.innerHTML = renderGrade(gradeById(route[1]));
  else if (route[0] === 'grade' && route.length === 3) app.innerHTML = renderSubject(gradeById(route[1]), subjectById(route[2]));
  else if (route[0] === 'grade' && route.length === 4) app.innerHTML = renderTerm(gradeById(route[1]), subjectById(route[2]), termById(route[3]));
  else if (route[0] === 'announcements') app.innerHTML = renderAnnouncements();
  else if (route[0] === 'about') app.innerHTML = renderAbout();
  else if (route[0] === 'admin') app.innerHTML = renderAdmin();
  else app.innerHTML = renderNotFound();
  localizeDom(app);
  monitorLogoImages(app);
  updateNavigation();
}

function updateNavigation() {
  const route = currentRoute();
  document.querySelectorAll('[data-nav]').forEach((link) => {
    const active = link.dataset.nav === 'home' ? route === '/' : route.startsWith(`/${link.dataset.nav}`);
    link.classList.toggle('active', active);
  });
  const menu = document.querySelector('.main-nav');
  menu.classList.remove('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
  window.scrollTo({ top: 0, behavior: 'auto' });
}

function resetForm() {
  editId = null;
  render();
}

app.addEventListener('submit', async (event) => {
  if (event.target.id === 'adminLoginForm') {
    event.preventDefault();
    const form = event.target;
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    form.setAttribute('aria-busy', 'true');
    const submitButton = form.querySelector('[type="submit"]');
    const originalLabel = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = currentLocale === 'en' ? 'Signing in…' : 'جارٍ تسجيل الدخول…';
    const formData = new FormData(event.target);
    try {
      const session = await apiRequest('./api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.get('username'), password: formData.get('password') })
      });
      csrfToken = session.csrfToken;
      adminUsername = session.username;
      records = await apiRequest('./api/resources');
      knownResourceIds = new Set(records.map((record) => record.id));
      refreshObjectUrls();
      render();
      announceToast('تم تسجيل الدخول بنجاح.');
    } catch (error) {
      console.warn('Administrator sign-in failed', error);
      announceToast(error.status === 401 ? 'بيانات تسجيل الدخول غير صحيحة.' : 'تعذّر تسجيل الدخول.');
    } finally {
      form.dataset.submitting = 'false';
      form.removeAttribute('aria-busy');
      submitButton.disabled = false;
      submitButton.textContent = originalLabel;
    }
    return;
  }
  if (event.target.id !== 'resourceForm') return;
  event.preventDefault();
  const form = event.target;
  if (form.dataset.submitting === 'true') return;
  const data = new FormData(form);
  const file = form.elements.file.files[0];
  const old = records.find((record) => record.id === editId);
  const urlInput = String(data.get('url') || '').trim();
  const safeUrl = safeExternalUrl(urlInput);
  if (urlInput && !safeUrl) return announceToast('أدخل رابطًا صحيحًا يبدأ بـ https أو http.');
  if (file && safeUrl) return announceToast('اختر رفع ملف أو إضافة رابط، وليس الاثنين معًا.');
  if (file && file.size > 100 * 1024 * 1024) return announceToast('الحد الأقصى للملف 100 ميجابايت. استخدم رابطًا مباشرًا للملفات الأكبر.');
  const type = String(data.get('type'));
  if (file && !file.type.startsWith(`${type}/`) && !(type === 'pdf' && file.type === 'application/pdf')) {
    return announceToast(`نوع الملف لا يتوافق مع اختيار ${typeName(type)}.`);
  }
  if (type === 'video' && safeUrl && !youtubeEmbed(safeUrl)) return announceToast('رابط الفيديو يجب أن يكون من YouTube أو ارفع ملف فيديو.');
  if (!file && !safeUrl && !old?.mediaBlob && !old?.fileUrl) return announceToast('أضف ملفًا أو رابطًا للمادة.');
  const record = {
    id: editId || (crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    title: String(data.get('title') || '').trim(),
    description: String(data.get('description') || '').trim(),
    gradeId: String(data.get('gradeId')),
    subjectId: String(data.get('subjectId')),
    termId: String(data.get('termId')),
    type,
    url: safeUrl,
    mediaBlob: file || (safeUrl ? null : old?.mediaBlob || null),
    updatedAt: new Date().toISOString()
  };
  form.dataset.submitting = 'true';
  form.setAttribute('aria-busy', 'true');
  const submitButton = form.querySelector('[type="submit"]');
  const originalLabel = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = currentLocale === 'en' ? 'Saving…' : 'جارٍ الحفظ…';
  try {
    if (storageMode === 'server') {
      if (!adminUsername || !csrfToken) throw new Error('Sign in as an administrator to continue.');
      data.set('url', safeUrl);
      const saved = await apiRequest(editId ? `./api/resources/${encodeURIComponent(editId)}` : './api/resources', {
        method: editId ? 'PUT' : 'POST',
        headers: { 'X-CSRF-Token': csrfToken },
        body: data
      });
      records = [saved, ...records.filter((item) => item.id !== saved.id)];
      knownResourceIds.add(saved.id);
    } else {
      await writeRecord(record);
      records = await readAllRecords();
    }
    refreshObjectUrls();
    editId = null;
    render();
    if (old) announceToast('تم حفظ التعديلات.');
    else {
      announceToast(localizedNewMaterialMessage(record), false);
      notifyNewMaterial(record);
    }
  } catch (error) {
    console.error(error);
    announceToast(storageMode === 'server' ? 'تعذّر حفظ المادة على الخادم.' : 'تعذّر حفظ المادة. قد يكون الملف أكبر من مساحة التخزين المتاحة.');
  } finally {
    form.dataset.submitting = 'false';
    form.removeAttribute('aria-busy');
    submitButton.disabled = false;
    submitButton.textContent = originalLabel;
  }
});

app.addEventListener('click', async (event) => {
  if (event.target.closest('#retryServer')) {
    try {
      await connectSharedServer();
      render();
    } catch (error) {
      console.warn('Could not connect to shared storage', error);
      announceToast('تعذّر تحميل مواد الخادم.');
    }
    return;
  }
  if (event.target.closest('#adminLogout')) {
    try {
      await apiRequest('./api/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
      csrfToken = '';
      adminUsername = '';
      render();
      announceToast('تم تسجيل الخروج.');
    } catch (error) {
      console.error(error);
      announceToast('تعذّر تسجيل الخروج.');
    }
    return;
  }
  const editButton = event.target.closest('[data-edit]');
  if (editButton) {
    editId = editButton.dataset.edit;
    render();
    document.getElementById('resourceTitle')?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const deleteButton = event.target.closest('[data-delete]');
  if (deleteButton) {
    const record = records.find((item) => item.id === deleteButton.dataset.delete);
    if (!record) return;
    const confirmMessage = currentLocale === 'en' ? `Delete “${record.title}”?` : `هل تريد حذف «${record.title}»؟`;
    if (!window.confirm(confirmMessage)) return;
    deleteButton.disabled = true;
    try {
      if (storageMode === 'server') {
        await apiRequest(`./api/resources/${encodeURIComponent(record.id)}`, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken }
        });
        records = records.filter((item) => item.id !== record.id);
        knownResourceIds.delete(record.id);
      } else {
        await removeRecord(record.id);
        records = await readAllRecords();
      }
      refreshObjectUrls();
      if (editId === record.id) editId = null;
      render();
      announceToast('حُذفت المادة.');
    } catch (error) {
      console.error(error);
      announceToast(storageMode === 'server' ? 'تعذّر حذف المادة من الخادم.' : 'تعذّر حذف المادة.');
      deleteButton.disabled = false;
    }
    return;
  }
  if (event.target.closest('#cancelEdit')) resetForm();
});

document.getElementById('menuToggle').addEventListener('click', () => {
  const menu = document.querySelector('.main-nav');
  const isOpen = menu.classList.toggle('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded', String(isOpen));
});

document.getElementById('languageSwitch').addEventListener('click', () => {
  const nextLocale = currentLocale === 'ar' ? 'en' : 'ar';
  setLocale(nextLocale, true, false);
  const menu = document.querySelector('.main-nav');
  menu.classList.remove('open');
  document.getElementById('menuToggle').setAttribute('aria-expanded', 'false');
});

document.getElementById('themeToggle').addEventListener('click', () => {
  const menu = document.getElementById('themeMenu');
  const open = menu.hidden;
  menu.hidden = !open;
  document.getElementById('themeToggle').setAttribute('aria-expanded', String(open));
});
document.getElementById('themeMenu').addEventListener('click', (event) => {
  const notificationAction = event.target.closest('[data-notification-action]');
  if (notificationAction) {
    enableNotifications();
    return;
  }
  const choice = event.target.closest('[data-theme-choice]');
  if (choice) {
    setTheme(choice.dataset.themeChoice, true);
    closeThemeMenu(true);
    return;
  }
  const localeChoice = event.target.closest('[data-locale-choice]');
  if (localeChoice) {
    setLocale(localeChoice.dataset.localeChoice, true, false);
    closeThemeMenu(true);
  }
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('.theme-control')) closeThemeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.getElementById('themeMenu').hidden) closeThemeMenu(true);
});
window.addEventListener('languagechange', () => {
  if (document.documentElement.dataset.localeChoice === 'system') setLocale('system', false, false);
});
const handleSystemThemeChange = () => {
  if (document.documentElement.dataset.themeChoice === 'system') setTheme('system');
};
if (systemTheme.addEventListener) systemTheme.addEventListener('change', handleSystemThemeChange);
else systemTheme.addListener(handleSystemThemeChange);

window.addEventListener('hashchange', render);
window.addEventListener('online', () => {
  document.getElementById('offlineBanner').hidden = true;
  syncSharedResources();
});
window.addEventListener('offline', () => { document.getElementById('offlineBanner').hidden = false; });
window.addEventListener('focus', syncSharedResources);
document.addEventListener('visibilitychange', syncSharedResources);
window.setInterval(syncSharedResources, 60_000);
if (!navigator.onLine) document.getElementById('offlineBanner').hidden = false;

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const installButton = document.getElementById('installButton');
if (isIOS && !standalone) installButton.hidden = false;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
window.addEventListener('appinstalled', () => { installButton.hidden = true; announceToast('تم تثبيت التطبيق بنجاح.'); });
installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    document.getElementById('installModal').hidden = false;
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
document.querySelectorAll('[data-close-install]').forEach((button) => button.addEventListener('click', () => { document.getElementById('installModal').hidden = true; }));
document.getElementById('installModal').addEventListener('click', (event) => { if (event.target.id === 'installModal') event.currentTarget.hidden = true; });

async function start() {
  monitorLogoImages(document);
  if (location.protocol === 'file:') {
    try {
      database = await openDatabase();
      records = await readAllRecords();
      storageMode = 'local';
      refreshObjectUrls();
    } catch (error) {
      storageMode = 'unavailable';
      console.warn('Could not open local preview storage', error);
    }
  } else {
    try {
      await connectSharedServer();
    } catch (error) {
      storageMode = 'unavailable';
      records = [];
      console.warn('Could not connect to shared content storage', error);
    }
  }
  render();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed', error));
  }
}
start();
