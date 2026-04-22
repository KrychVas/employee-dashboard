const STORAGE_KEY = 'monthlyData';

export const state = {
    currentYear: 2026,
    currentMonth: 3, // Квітень (0-indexed)
    data: loadFromStorage()
};

function loadFromStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    
    // Початкові дані, якщо сховище порожнє
    return {
        "2026-3": { employees: [], projects: [] }
    };
}

export function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

export function getCurrentMonthData() {
    const key = `${state.currentYear}-${state.currentMonth}`;
    if (!state.data[key]) {
        state.data[key] = { employees: [], projects: [] };
    }
    return state.data[key];
}