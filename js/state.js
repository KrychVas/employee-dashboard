const STORAGE_KEY = 'monthlyData';

export const state = {
    currentYear: 2026,
    currentMonth: 3, // Квітень (0-indexed)
    // Додаємо ці два поля для роботи сортування та фільтрів:
    sortConfig: { key: null, direction: 'asc', table: null },
    filters: {},
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

// Зміна періоду
export function updatePeriod(year, month) {
    state.currentYear = parseInt(year);
    state.currentMonth = parseInt(month);
}

// Додаємо функцію копіювання місяця (Snapshot)
export function copyFromPreviousMonth() {
    const prevMonth = state.currentMonth === 0 ? 11 : state.currentMonth - 1;
    const prevYear = state.currentMonth === 0 ? state.currentYear - 1 : state.currentYear;
    const prevKey = `${prevYear}-${prevMonth}`;
    const currentKey = `${state.currentYear}-${state.currentMonth}`;

    if (state.data[prevKey]) {
        const newData = JSON.parse(JSON.stringify(state.data[prevKey]));
        // Вимога: Дні відпустки очищуються під час копіювання
        newData.employees.forEach(e => e.vacationDays = []);
        state.data[currentKey] = newData;
        saveState();
        return true;
    }
    return false;
}