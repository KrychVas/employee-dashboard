export const calculations = {
    // Рахуємо лише робочі дні (Пн-Пт) для знаменника коефіцієнта
    getWorkingDaysCount(year, month) {
        const lastDay = new Date(year, month + 1, 0).getDate();
        let count = 0;
        for (let d = 1; d <= lastDay; d++) {
            const dayOfWeek = new Date(year, month, d).getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
        }
        return count;
    },

    // Рахуємо дні відпустки, що випали на робочі дні (Requirement 12)
    getVacationCoefficient(year, month, vacationDays = []) {
        const totalWorkingDays = this.getWorkingDaysCount(year, month);
        if (totalWorkingDays === 0) return 0;

        let vacationWorkingDays = 0;
        vacationDays.forEach(day => {
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) vacationWorkingDays++;
        });

        return (totalWorkingDays - vacationWorkingDays) / totalWorkingDays;
    },

    // Ефективна потужність: capacity * fit * vacationCoefficient
    calculateEffectiveCapacity(assignedCapacity, fit, vacationCoefficient) {
        return assignedCapacity * fit * vacationCoefficient;
    },

    // Вартість працівника: мінімум 0.5 від зарплати (Bench payment)
    calculateEmployeeCost(salary, assignedCapacity) {
        return salary * Math.max(0.5, assignedCapacity);
    }
};