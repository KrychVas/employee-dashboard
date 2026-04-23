// js/calculations.js

export const calculations = {
    /**
     * Рахує кількість робочих днів (Пн-Пт) у конкретному місяці року
     */
    getWorkingDaysCount(year, month) {
        // Отримуємо останній день місяця
        const lastDay = new Date(year, month + 1, 0).getDate();
        let workingDays = 0;

        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            // 0 - Неділя, 6 - Субота
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
        }
        return workingDays;
    },

    /**
     * Рахує коефіцієнт відпустки
     */
    getVacationCoefficient(totalWorkingDays, vacationDays) {
        if (totalWorkingDays === 0) return 0;
        return (totalWorkingDays - vacationDays) / totalWorkingDays;
    }
};