"use strict";

// ASQA 2.0 — MALİYYƏ SİSTEMİ

const STORAGE_KEY = "asqa_finance_v1";

const $ = id => document.getElementById(id);

function emptyData() {
    return {
        card: 0,
        cash: 0,
        transactions: [],
        transfers: [],
        goal: {
            name: "",
            amount: 0
        }
    };
}

let data = emptyData();
let currentType = "income";
let editingId = null;

// KÖMƏKÇİ FUNKSİYALAR

function money(value) {
    return Number(value || 0).toFixed(2) + " ₼";
}

function round(value) {
    return Math.round(
        (value + Number.EPSILON) * 100
    ) / 100;
}

function validAmount(value) {
    const amount = Number(value);

    return (
        String(value).trim() !== "" &&
        Number.isFinite(amount) &&
        amount > 0 &&
        Math.abs(
            amount * 100 - Math.round(amount * 100)
        ) < 0.000001
    );
}

function newId() {
    if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
    ) {
        return window.crypto.randomUUID();
    }

    return String(Date.now()) + Math.random();
}

function accountName(account) {
    return account === "card" ? "Kart" : "Nağd";
}

// YADDAŞ

function loadData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);

        if (!saved) return;

        const parsed = JSON.parse(saved);

        if (!parsed || typeof parsed !== "object") {
            return;
        }

        data = {
            ...emptyData(),
            ...parsed,

            transactions: Array.isArray(parsed.transactions)
                ? parsed.transactions
                : [],

            transfers: Array.isArray(parsed.transfers)
                ? parsed.transfers
                : [],

            goal: {
                name: "",
                amount: 0,
                ...(parsed.goal || {})
            }
        };

    } catch (error) {
        console.error(error);
        alert("Yaddaş məlumatlarını oxumaq mümkün olmadı.");
    }
}

function saveData() {
    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(data)
        );

        return true;

    } catch (error) {
        alert("Məlumatları yadda saxlamaq mümkün olmadı.");
        return false;
    }
}

// SƏHİFƏLƏR

function showPage(pageId, button) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    $(pageId).classList.add("active");

    document.querySelectorAll(".bottom-nav button").forEach(btn => {
        btn.classList.remove("active");
    });

    button.classList.add("active");

    renderAll();
    window.scrollTo(0, 0);
}

// PƏNCƏRƏLƏR

function closeModals() {
    document.querySelectorAll(".modal").forEach(modal => {
        modal.classList.remove("active");
    });
}

// QAZANC VƏ XƏRC

function openTransaction(type, id = null) {
    currentType = type;
    editingId = id;

    $("transactionTitle").textContent =
        type === "income"
            ? "🟢 Qazanc əlavə et"
            : "🔴 Xərc əlavə et";

    $("descriptionLabel").textContent =
        type === "income"
            ? "Pulun mənbəyi"
            : "Xərcin səbəbi";

    $("descriptionInput").placeholder =
        type === "income"
            ? "Məsələn: Maaş"
            : "Məsələn: Dönər";

    $("amountInput").value = "";
    $("descriptionInput").value = "";
    $("accountInput").value = "card";

    if (id !== null) {
        const transaction = data.transactions.find(
            t => t.id === id
        );

        if (!transaction) return;

        $("amountInput").value = transaction.amount;
        $("descriptionInput").value = transaction.description;
        $("accountInput").value = transaction.account;

        $("transactionTitle").textContent =
            "✏️ Əməliyyatı redaktə et";
    }

    $("transactionModal").classList.add("active");
}

function applyTransaction(balances, transaction, direction = 1) {
    const sign = transaction.type === "income" ? 1 : -1;

    balances[transaction.account] = round(
        balances[transaction.account] +
        sign * transaction.amount * direction
    );
}

function saveTransaction() {
    const raw = $("amountInput").value;
    const amount = round(Number(raw));
    const description = $("descriptionInput").value.trim();
    const account = $("accountInput").value;

    if (!validAmount(raw)) {
        alert("Düzgün məbləğ daxil et.");
        return;
    }

    if (!description) {
        alert("Pulun mənbəyini və ya xərcin səbəbini yaz.");
        return;
    }

    const old = editingId === null
        ? null
        : data.transactions.find(t => t.id === editingId);

    if (editingId !== null && !old) return;

    const balances = {
        card: Number(data.card),
        cash: Number(data.cash)
    };

    if (old) {
        applyTransaction(balances, old, -1);
    }

    const transaction = {
        id: old ? old.id : newId(),
        type: currentType,
        amount,
        description,
        account,
        date: old ? old.date : new Date().toISOString()
    };

    applyTransaction(balances, transaction);

    if (balances.card < -0.001 || balances.cash < -0.001) {
        alert("Seçilmiş hesabda kifayət qədər pul yoxdur.");
        return;
    }

    const previous = JSON.stringify(data);

    data.card = balances.card;
    data.cash = balances.cash;

    if (old) {
        data.transactions = data.transactions.filter(
            t => t.id !== old.id
        );
    }

    data.transactions.push(transaction);

    if (!saveData()) {
        data = JSON.parse(previous);
        return;
    }

    closeModals();
    renderAll();
}

function deleteTransaction(id) {
    const transaction = data.transactions.find(
        t => t.id === id
    );

    if (!transaction) return;

    if (!confirm("Bu əməliyyat silinsin?")) return;

    const balances = {
        card: Number(data.card),
        cash: Number(data.cash)
    };

    applyTransaction(balances, transaction, -1);

    if (balances.card < -0.001 || balances.cash < -0.001) {
        alert(
            "Bu əməliyyatı silmək balansı mənfi edəcək."
        );
        return;
    }

    const previous = JSON.stringify(data);

    data.card = balances.card;
    data.cash = balances.cash;

    data.transactions = data.transactions.filter(
        t => t.id !== id
    );

    if (!saveData()) {
        data = JSON.parse(previous);
        return;
    }

    renderAll();
}

// KART VƏ NAĞD ARASINDA KÖÇÜRMƏ

function openTransfer() {
    $("transferAmount").value = "";
    $("transferFrom").value = "card";
    $("transferTo").value = "cash";

    $("transferModal").classList.add("active");
}

function saveTransfer() {
    const raw = $("transferAmount").value;
    const amount = round(Number(raw));

    const from = $("transferFrom").value;
    const to = $("transferTo").value;

    if (!validAmount(raw)) {
        alert("Düzgün məbləğ daxil et.");
        return;
    }

    if (from === to) {
        alert("Fərqli hesablar seç.");
        return;
    }

    if (data[from] < amount) {
        alert("Hesabda kifayət qədər pul yoxdur.");
        return;
    }

    const previous = JSON.stringify(data);

    data[from] = round(data[from] - amount);
    data[to] = round(data[to] + amount);

    data.transfers.push({
        id: newId(),
        amount,
        from,
        to,
        date: new Date().toISOString()
    });

    if (!saveData()) {
        data = JSON.parse(previous);
        return;
    }

    closeModals();
    renderAll();
}

// BALANSLAR

function renderBalances() {
    const total = round(
        Number(data.card) + Number(data.cash)
    );

    $("totalBalance").textContent = money(total);
    $("cardBalance").textContent = money(data.card);
    $("cashBalance").textContent = money(data.cash);
    $("statsBalance").textContent = money(total);
}

// TARİXÇƏ

function sortedTransactions(type, search = "") {
    return data.transactions
        .filter(t => t.type === type)
        .filter(t =>
            String(t.description)
                .toLowerCase()
                .includes(search.toLowerCase())
        )
        .sort((a, b) =>
            new Date(b.date) - new Date(a.date)
        );
}

function transactionElement(t) {
    const item = document.createElement("div");
    item.className = "glass transaction";

    const left = document.createElement("div");

    const title = document.createElement("div");
    title.className = "transaction-name";
    title.textContent = t.description;

    const meta = document.createElement("div");
    meta.className = "transaction-meta";

    meta.textContent =
        accountName(t.account) + " • " +
        new Date(t.date).toLocaleString("az-AZ");

    left.append(title, meta);

    const right = document.createElement("div");
    right.className = "transaction-right";

    const amount = document.createElement("div");
    amount.className =
        "transaction-value " +
        (t.type === "income" ? "green" : "red");

    amount.textContent =
        (t.type === "income" ? "+" : "−") +
        money(t.amount);

    const actions = document.createElement("div");
    actions.className = "mini-actions";

    const edit = document.createElement("button");
    edit.textContent = "Düzəlt";
    edit.onclick = () => openTransaction(t.type, t.id);

    const remove = document.createElement("button");
    remove.textContent = "Sil";
    remove.onclick = () => deleteTransaction(t.id);

    actions.append(edit, remove);
    right.append(amount, actions);
    item.append(left, right);

    return item;
}

function renderHistory(type) {
    const searchInput = $(
        type === "income"
            ? "incomeSearch"
            : "expenseSearch"
    );

    const container = $(
        type === "income"
            ? "incomeHistory"
            : "expenseHistory"
    );

    const search = searchInput.value.trim();
    const transactions = sortedTransactions(type, search);

    container.replaceChildren();

    if (!transactions.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "Hələ əməliyyat yoxdur.";
        container.append(empty);
        return;
    }

    transactions.forEach(t => {
        container.append(transactionElement(t));
    });
}

function renderRecent() {
    const container = $("recentTransactions");
    container.replaceChildren();

    const recent = [...data.transactions]
        .sort
