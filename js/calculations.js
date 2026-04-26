// js/calculations.js

export const calculations = {
    /**
     * Рахує кількість робочих днів (Пн-Пт) у конкретному місяці року
     */
    getWorkingDaysCount(year, month) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        let workingDays = 0;

        for (let day = 1; day <= lastDay; day++) {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            // 0 - Неділя, 6 - Субота. Решта - робочі.
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
                workingDays++;
            }
        }
        return workingDays;
    },

    /**
     * Рахує коефіцієнт ефективності з урахуванням відпустки
     * Наприклад: 20 робочих днів, 2 дні відпустки -> коефіцієнт 0.9
     */
    getVacationCoefficient(totalWorkingDays, vacationDays) {
        if (!totalWorkingDays || totalWorkingDays <= 0) return 0;
        const activeDays = totalWorkingDays - (vacationDays || 0);
        return Math.max(0, activeDays / totalWorkingDays);
    },

    /**
     * Розрахунок фактичної вартості співробітника для компанії в цьому місяці
     */
    calculateEffectiveSalary(salary, totalWorkingDays, vacationDays) {
        const coef = this.getVacationCoefficient(totalWorkingDays, vacationDays);
        // Якщо людина у відпустці, компанія все одно платить salary, 
        // але "ефективна вартість" робочого часу може змінюватися для аналітики
        return salary * coef; 
    }
};