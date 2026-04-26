const STORAGE_KEY = 'monthlyData';

export const state = {
    currentYear: 2026,
    currentMonth: 3, // Квітень (0-indexed)
    data: loadFromStorage()
};

function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    
    // Початкові дані
    return {
        "2026-3": { employees: [], projects: [] }
    };
}

export function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

// Функція для отримання даних саме за обраний період
export function getCurrentMonthData() {
    const key = `${state.currentYear}-${state.currentMonth}`;
    if (!state.data[key]) {
        // Якщо даних для цього місяця ще немає, створюємо порожню структуру
        state.data[key] = { employees: [], projects: [] };
    }
    return state.data[key];
}

// НОВА ФУНКЦІЯ: Зміна періоду
export function updatePeriod(year, month) {
    state.currentYear = parseInt(year);
    state.currentMonth = parseInt(month);
    // Дані створяться автоматично при першому виклику getCurrentMonthData
}