(function () {
  const form = document.querySelector("#caseForm");
  const list = document.querySelector("#caseList");
  const clear = document.querySelector("#clearCases");
  const storageKey = "legal-os.case-cards";

  if (!form || !list) {
    return;
  }

  const readCards = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  };

  const writeCards = (cards) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cards));
      return true;
    } catch (error) {
      window.alert("Не удалось сохранить карточку: локальное хранилище недоступно или переполнено.");
      return false;
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return "не указано";
    }
    const date = new Date(value + "T00:00:00");
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("uk-UA");
  };

  const render = () => {
    const cards = readCards();

    if (!cards.length) {
      list.innerHTML = '<p class="empty-state">Пока нет сохраненных карточек. Добавьте первую ручную проверку.</p>';
      return;
    }

    list.innerHTML = cards
      .map((card) => {
        const notes = card.notes ? `<p>${escapeHtml(card.notes)}</p>` : "";
        return `
          <article class="case-item">
            <h3>${escapeHtml(card.caseNumber)}</h3>
            <div class="case-meta">
              <span>Суд: ${escapeHtml(card.courtName || "не указан")}</span>
              <span>Метка: ${escapeHtml(card.clientName || "не указана")}</span>
              <span>Последняя проверка: ${formatDate(card.checkedAt)}</span>
              <span>Следующая проверка: ${formatDate(card.remindAt)}</span>
            </div>
            ${notes}
          </article>
        `;
      })
      .join("");
  };

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const card = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      caseNumber: data.get("caseNumber").trim(),
      courtName: data.get("courtName").trim(),
      clientName: data.get("clientName").trim(),
      checkedAt: data.get("checkedAt"),
      remindAt: data.get("remindAt"),
      notes: data.get("notes").trim(),
      source: "https://court.gov.ua/fair/",
      createdAt: new Date().toISOString(),
    };

    if (!card.caseNumber) {
      return;
    }

    const cards = [card, ...readCards()].slice(0, 20);
    if (!writeCards(cards)) {
      return;
    }
    form.reset();
    render();
  });

  if (clear) {
    clear.addEventListener("click", () => {
      if (!readCards().length) {
        return;
      }
      if (!window.confirm("Удалить все сохраненные карточки? Это действие нельзя отменить.")) {
        return;
      }
      localStorage.removeItem(storageKey);
      render();
    });
  }

  render();
})();
