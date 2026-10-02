// Tema: claro por padrão; o escuro fica salvo neste navegador quando escolhido no botão.
(function () {
  const raiz = document.documentElement;
  let salvo = null;
  try { salvo = localStorage.getItem('sv-tema'); } catch (e) { /* armazenamento indisponível */ }
  // Padrão claro; o escuro só entra quando a pessoa escolhe no botão.
  raiz.dataset.theme = salvo === 'dark' ? 'dark' : 'light';

  const escuroAgora = () =>
    raiz.dataset.theme ? raiz.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;

  function sincronizar(botao) {
    const escuro = escuroAgora();
    botao.querySelector('use').setAttribute('href', escuro ? '#i-sol' : '#i-lua');
    botao.querySelector('span').textContent = escuro ? 'Tema claro' : 'Tema escuro';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const botao = document.getElementById('alternar-tema');
    if (!botao) return;
    sincronizar(botao);
    botao.addEventListener('click', () => {
      raiz.dataset.theme = escuroAgora() ? 'light' : 'dark';
      try { localStorage.setItem('sv-tema', raiz.dataset.theme); } catch (e) { /* ok */ }
      sincronizar(botao);
    });
  });
})();
