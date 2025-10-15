(function() {
  try {
    var theme = localStorage.getItem('matsu-theme') || 'system';
    var darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (theme === 'dark' || (theme === 'system' && darkQuery.matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
