/* Apariencia del dispositivo y preferencia local. Se ejecuta antes del CSS. */
var SalvaTuCursoTheme = (function themeController() {
  'use strict';
  const KEY = 'salvatucursoTema';
  const allowed = ['system', 'light', 'dark'];
  let preference = 'system';
  try {
    const saved = localStorage.getItem(KEY);
    if (allowed.includes(saved)) preference = saved;
  } catch (error) { /* La apariencia sigue funcionando sin almacenamiento. */ }
  const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function resolved() {
    return preference === 'system' ? (media && media.matches ? 'dark' : 'light') : preference;
  }
  function syncSettings() {
    const select = document.getElementById('cfg-theme');
    const status = document.getElementById('cfg-theme-status');
    if (select) select.value = preference;
    if (status) status.textContent = preference === 'system'
      ? 'Sigue el dispositivo. Ahora está activo el modo ' + (resolved() === 'dark' ? 'oscuro.' : 'claro.')
      : 'Usar siempre el modo ' + (preference === 'dark' ? 'oscuro.' : 'claro.');
  }
  function apply() {
    const theme = resolved();
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === 'dark' ? '#172535' : '#ffffff';
    syncSettings();
  }
  function setPreference(value) {
    if (!allowed.includes(value)) return false;
    preference = value;
    let persisted = true;
    try { localStorage.setItem(KEY, value); } catch (error) { persisted = false; }
    apply();
    return persisted;
  }
  function systemChanged() {
    if (preference === 'system') apply();
  }
  if (media && typeof media.addEventListener === 'function') media.addEventListener('change', systemChanged);
  else if (media && typeof media.addListener === 'function') media.addListener(systemChanged);
  apply();
  return { getPreference: () => preference, getResolved: resolved, setPreference, syncSettings };
})();
