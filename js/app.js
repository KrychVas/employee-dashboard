import { state, saveState, getCurrentMonthData, copyFromPreviousMonth } from './state.js';
import { calculations } from './calculations.js';

// --- ЕЛЕМЕНТИ ІНТЕРФЕЙСУ ---
const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const sidePanel = document.getElementById('side-panel');
const overlay = document.getElementById('overlay');
const seedDataBtn = document.getElementById('seedDataBtn');

const POSITIONS = ["Junior", "Middle", "Senior", "Lead", "Architect"];

// --- 1. ДОПОМІЖНІ ФУНКЦІЇ ---

function calculateAge(dobString) {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
}

function formatCurrency(amount) {
    return amount.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(',', '.');
}

function formatVacationPeriods(days) {
    if (!days || days.length === 0) return '—';
    const sorted = [...days].sort((a, b) => a - b);
    const periods = [];
    let start = sorted[0], end = start;
    for (let i = 1; i <= sorted.length; i++) {
        if (sorted[i] === end + 1) { end = sorted[i]; } 
        else {
            periods.push(start === end ? `${String(start).padStart(2, '0')}` : `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`);
            start = sorted[i]; end = start;
        }
    }
    return periods.join(', ');
}

// --- 2. СОРТУВАННЯ ТА ФІЛЬТРАЦІЯ ---

function applyFiltersAndSort(data, tableType) {
    let filtered = [...data];
    
    Object.keys(state.filters).forEach(key => {
        if (state.filters[key]) {
            filtered = filtered.filter(item => 
                String(item[key]).toLowerCase().includes(state.filters[key].toLowerCase())
            );
        }
    });

    const { key, direction, table } = state.sortConfig;
    if (key && table === tableType) {
        filtered.sort((a, b) => {
            let valA, valB;
            if (key === 'age') { valA = calculateAge(a.dob); valB = calculateAge(b.dob); }
            else if (key === 'profit') { valA = calculateProjectFinances(a).profit; valB = calculateProjectFinances(b).profit; }
            else { valA = a[key]; valB = b[key]; }

            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    return filtered;
}

window.toggleSort = function(key, tableType) {
    if (state.sortConfig.key === key) {
        state.sortConfig.direction = state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortConfig.key = key;
        state.sortConfig.direction = 'asc';
        state.sortConfig.table = tableType;
    }
    tableType === 'emp' ? renderEmployeesTable() : renderProjectsTable();
};

window.setFilter = function(key) {
    const val = prompt(`Filter by ${key}:`, state.filters[key] || "");
    if (val !== null) {
        if (val === "") delete state.filters[key];
        else state.filters[key] = val;
        renderEmployeesTable();
        renderProjectsTable();
    }
};

window.removeFilter = function(key) {
    delete state.filters[key];
    renderEmployeesTable();
    renderProjectsTable();
};

window.clearFilters = function() {
    state.filters = {};
    renderEmployeesTable();
    renderProjectsTable();
};

function getSortIcon(key, tableType) {
    if (state.sortConfig.table !== tableType || state.sortConfig.key !== key) return '⇅';
    return state.sortConfig.direction === 'asc' ? '↑' : '↓';
}

function renderFilterChips() {
    const keys = Object.keys(state.filters);
    if (keys.length === 0) return '';
    return `
        <div class="filter-chips">
            ${keys.map(k => `<span class="chip">${k}: ${state.filters[k]} <b onclick="removeFilter('${k}')">×</b></span>`).join('')}
            ${keys.length > 1 ? `<button class="btn-danger-small" onclick="clearFilters()">Clear All</button>` : ''}
        </div>`;
}

// --- 3. РОЗРАХУНКИ ---

function calculateProjectFinances(project) {
    const { employees } = getCurrentMonthData();
    let totalUsedEffectiveCapacity = 0, totalProjectCosts = 0;

    project.assignments.forEach(assign => {
        const emp = employees.find(e => e.id === assign.employeeId);
        if (emp) {
            const vacCoef = calculations.getVacationCoefficient(state.currentYear, state.currentMonth, emp.vacationDays || []);
            // ВИПРАВЛЕНО: Використання коефіцієнта Fit з об'єкта призначення
            const fit = assign.fit || 1.0;
            const effCap = calculations.calculateEffectiveCapacity(assign.capacity, fit, vacCoef); 
            totalUsedEffectiveCapacity += effCap;
            
            // ВИПРАВЛЕНО: Використання пропорційної вартості для проекту
            totalProjectCosts += calculations.calculateEmployeeProjectCost(emp.salary, assign.capacity);
        }
    });

    const capForRevenue = Math.max(project.projectCapacity, totalUsedEffectiveCapacity);
    const revenuePerCap = capForRevenue > 0 ? project.budget / capForRevenue : 0;
    const totalProjectRevenue = revenuePerCap * totalUsedEffectiveCapacity;

    return { usedCapacity: totalUsedEffectiveCapacity, costs: totalProjectCosts, profit: totalProjectRevenue - totalProjectCosts };
}

function calculateCompanyTotalIncome() {
    const { employees, projects } = getCurrentMonthData();
    // Чистий прибуток від усіх проектів
    let totalProjectProfit = projects.reduce((sum, proj) => sum + calculateProjectFinances(proj).profit, 0);
    
    let totalBenchCost = 0;
    employees.forEach(emp => {
        const totalLoad = projects.reduce((sum, p) => {
            const a = p.assignments.find(as => as.employeeId === emp.id);
            return sum + (a ? a.capacity : 0);
        }, 0);
        
        // ВИПРАВЛЕНО: Логіка Bench Cost (доплата до 0.5 окладу, якщо завантаження менше)
        if (totalLoad < 0.5) { 
            totalBenchCost += emp.salary * (0.5 - totalLoad); 
        }
    });
    
    return { finalIncome: totalProjectProfit - totalBenchCost, benchCost: totalBenchCost };
}

// --- 4. РЕНДЕРИНГ ТАБЛИЦЬ ---

function renderEmployeesTable() {
    const container = document.getElementById('employees-table-container');
    if (!container) return;
    const { employees, projects } = getCurrentMonthData();
    const filtered = applyFiltersAndSort(employees, 'emp');

    container.innerHTML = `
        ${renderFilterChips()}
        <table class="data-table">
            <thead>
                <tr>
                    <th onclick="toggleSort('firstName', 'emp')">Name / Vac ${getSortIcon('firstName', 'emp')} <span onclick="event.stopPropagation(); setFilter('firstName')">⌕</span></th>
                    <th onclick="toggleSort('age', 'emp')">Age ${getSortIcon('age', 'emp')}</th>
                    <th onclick="toggleSort('position', 'emp')">Pos ${getSortIcon('position', 'emp')} <span onclick="event.stopPropagation(); setFilter('position')">⌕</span></th>
                    <th onclick="toggleSort('salary', 'emp')">Salary ${getSortIcon('salary', 'emp')}</th>
                    <th>Load</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(emp => {
                    const empLoad = projects.reduce((sum, p) => {
                        const a = p.assignments.find(as => as.employeeId === emp.id);
                        return sum + (a ? a.capacity : 0);
                    }, 0);
                    return `
                    <tr>
                        <td><strong>${emp.firstName} ${emp.lastName}</strong><div style="font-size:0.7rem;color:#718096;">📅 ${formatVacationPeriods(emp.vacationDays)}</div></td>
                        <td>${calculateAge(emp.dob)}</td>
                        <td>${emp.position}</td>
                        <td>$${formatCurrency(emp.salary)}</td>
                        <td><span class="btn-small">${empLoad.toFixed(1)} / 1.5</span></td>
                        <td>
                            <button class="btn-small" onclick="openAvailabilityCalendar(${emp.id})">📅</button>
                            <button class="btn-small" ${empLoad >= 1.5 ? 'disabled' : ''} onclick="openAssignModal(${emp.id})">🔗</button>
                            <button class="btn-small" onclick="editEmployee(${emp.id})">Edit</button>
                            <button class="btn-danger-small" onclick="deleteEmployee(${emp.id})">Del</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function renderProjectsTable() {
    const container = document.getElementById('projects-table-container');
    if (!container) return;
    const { projects } = getCurrentMonthData();
    const filtered = applyFiltersAndSort(projects, 'proj');
    const { finalIncome, benchCost } = calculateCompanyTotalIncome();

    container.innerHTML = `
        ${renderFilterChips()}
        <table class="data-table">
            <thead>
                <tr>
                    <th onclick="toggleSort('company', 'proj')">Company ${getSortIcon('company', 'proj')} <span onclick="event.stopPropagation(); setFilter('company')">⌕</span></th>
                    <th onclick="toggleSort('name', 'proj')">Project ${getSortIcon('name', 'proj')} <span onclick="event.stopPropagation(); setFilter('name')">⌕</span></th>
                    <th onclick="toggleSort('budget', 'proj')">Budget ${getSortIcon('budget', 'proj')}</th>
                    <th>Capacity</th>
                    <th onclick="toggleSort('profit', 'proj')">Profit ${getSortIcon('profit', 'proj')}</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${filtered.map(proj => {
                    const fin = calculateProjectFinances(proj);
                    return `
                    <tr>
                        <td>${proj.company}</td><td><strong>${proj.name}</strong></td><td>$${formatCurrency(proj.budget)}</td>
                        <td>${fin.usedCapacity.toFixed(1)} / ${proj.projectCapacity}</td>
                        <td style="color:${fin.profit >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(fin.profit)}</td>
                        <td>
                            <button class="btn-small-edit" onclick="editProject(${proj.id})">Edit</button>
                            <button class="btn-danger-small" onclick="deleteProject(${proj.id})">Del</button>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        <div class="table-footer">
            <strong>Total Income: <span style="color:${finalIncome >= 0 ? '#27ae60' : '#e74c3c'}">$${formatCurrency(finalIncome)}</span></strong>
            <span style="font-size:0.8rem;color:#718096;margin-left:10px;">(Bench: $${formatCurrency(benchCost)})</span>
        </div>`;
}

// --- 5. МОДАЛЬНІ ВІКНА ---

function openSidePanel(html) { sidePanel.innerHTML = html; sidePanel.classList.add('open'); overlay.classList.add('active'); }
window.closeSidePanel = () => { sidePanel.classList.remove('open'); overlay.classList.remove('active'); };

window.openAvailabilityCalendar = function(id) {
    const emp = getCurrentMonthData().employees.find(e => e.id === id);
    const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
    const firstDay = new Date(state.currentYear, state.currentMonth, 1).getDay();
    
    let html = `<div class="calendar-container"><h3>Vacation: ${emp.firstName}</h3><div class="calendar-grid">`;
    ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => html += `<div class="day-name">${d}</div>`);
    for(let i=0; i<firstDay; i++) html += `<div class="empty"></div>`;
    for(let d=1; d<=daysInMonth; d++) {
        const isSel = (emp.vacationDays || []).includes(d);
        const isWknd = new Date(state.currentYear, state.currentMonth, d).getDay() % 6 === 0;
        html += `<div class="calendar-day ${isWknd ? 'weekend' : ''} ${isSel ? 'selected' : ''}" onclick="toggleVacDay(${id},${d},this)">${d}</div>`;
    }
    html += `</div><button class="btn-primary" style="width:100%;margin-top:20px;" onclick="closeSidePanel()">Close</button></div>`;
    openSidePanel(html);
};

window.toggleVacDay = (id, day, el) => {
    const emp = getCurrentMonthData().employees.find(e => e.id === id);
    if (!emp.vacationDays) emp.vacationDays = [];
    const idx = emp.vacationDays.indexOf(day);
    if (idx === -1) emp.vacationDays.push(day); else emp.vacationDays.splice(idx, 1);
    el.classList.toggle('selected'); saveState(); renderEmployeesTable(); renderProjectsTable();
};

window.openAssignModal = function(id) {
    const { employees, projects } = getCurrentMonthData();
    const emp = employees.find(e => e.id === id);
    const load = projects.reduce((s, p) => s + (p.assignments.find(a => a.employeeId === id)?.capacity || 0), 0);
    const avail = Math.max(0, (1.5 - load)).toFixed(1);

    //  Додано повзунок Fit (Відповідність проекту)
    openSidePanel(`
        <h3>Assign ${emp.firstName}</h3>
        <p>Available Load: <b>${avail}</b></p>
        <form id="assignF">
            <select name="pId" required>${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select>
            <div style="margin:15px 0">Capacity: <input type="range" name="cap" min="0.1" max="${avail}" step="0.1" value="0.1" oninput="v.innerText=this.value"> <span id="v">0.1</span></div>
            <div style="margin:15px 0">Fit (Match): <input type="range" name="fit" min="0.1" max="1.0" step="0.1" value="1.0" oninput="fv.innerText=this.value"> <span id="fv">1.0</span></div>
            <button type="submit" class="btn-primary" style="width:100%" ${avail <= 0 ? 'disabled' : ''}>Assign</button>
        </form>`);
        
    document.getElementById('assignF').onsubmit = (e) => {
        e.preventDefault(); 
        const fd = new FormData(e.target);
        const projId = parseInt(fd.get('pId'));
        const proj = projects.find(p => p.id === projId);
        
        //  Збереження fit в об'єкті призначення
        proj.assignments.push({ 
            employeeId: id, 
            capacity: parseFloat(fd.get('cap')),
            fit: parseFloat(fd.get('fit')) 
        });
        
        saveState(); closeSidePanel(); renderEmployeesTable(); renderProjectsTable();
    };
};

window.editEmployee = (id) => {
    const emp = getCurrentMonthData().employees.find(e => e.id === id);
    openSidePanel(`
        <h3>Edit Employee</h3>
        <form id="editE">
            <input type="text" name="fN" value="${emp.firstName}" required minlength="3">
            <input type="text" name="lN" value="${emp.lastName}" required minlength="3">
            <input type="date" name="dob" value="${emp.dob}" required>
            <label style="font-size:0.75rem; color:#718096; margin-top:10px; display:block;">Position:</label>
            <select name="pos">
                ${POSITIONS.map(p => `<option value="${p}" ${emp.position === p ? 'selected' : ''}>${p}</option>`).join('')}
            </select>
            <input type="number" name="sal" value="${emp.salary}" required style="margin-top:15px;">
            <button type="submit" class="btn-primary" style="width:100%">Update</button>
        </form>`);
    document.getElementById('editE').onsubmit = (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        if (calculateAge(fd.get('dob')) < 18) return alert("Must be 18+");
        Object.assign(emp, { 
            firstName: fd.get('fN'), lastName: fd.get('lN'), 
            dob: fd.get('dob'), salary: parseFloat(fd.get('sal')),
            position: fd.get('pos')
        });
        saveState(); closeSidePanel(); renderEmployeesTable(); renderProjectsTable();
    };
};

window.editProject = (id) => {
    const proj = getCurrentMonthData().projects.find(p => p.id === id);
    openSidePanel(`
        <h3>Edit Project</h3>
        <form id="editP">
            <input type="text" name="c" value="${proj.company}" required minlength="2">
            <input type="text" name="n" value="${proj.name}" required minlength="3">
            <input type="number" name="b" value="${proj.budget}" required>
            <input type="number" name="tc" value="${proj.projectCapacity}" step="0.1" required>
            <button type="submit" class="btn-primary" style="width:100%">Update Project</button>
        </form>`);
    document.getElementById('editP').onsubmit = (e) => {
        e.preventDefault(); const fd = new FormData(e.target);
        Object.assign(proj, { company: fd.get('c'), name: fd.get('n'), budget: parseFloat(fd.get('b')), projectCapacity: parseFloat(fd.get('tc')) });
        saveState(); closeSidePanel(); renderProjectsTable();
    };
};

window.deleteEmployee = (id) => { if(confirm("Delete employee?")) { const d = getCurrentMonthData(); d.employees = d.employees.filter(e => e.id !== id); d.projects.forEach(p => p.assignments = p.assignments.filter(a => a.employeeId !== id)); saveState(); renderEmployeesTable(); renderProjectsTable(); }};
window.deleteProject = (id) => { if(confirm("Delete project?")) { const d = getCurrentMonthData(); d.projects = d.projects.filter(p => p.id !== id); saveState(); renderProjectsTable(); renderEmployeesTable(); }};

// --- 6. ІНІЦІАЛІЗАЦІЯ ---

document.addEventListener('DOMContentLoaded', () => {
    // --- Логіка перемикання сайдбару ---
    const menuBtn = document.querySelector('.sidebar-header .icon-btn');
    const sidebar = document.querySelector('.sidebar');
    
    if (menuBtn && sidebar) {
        menuBtn.innerText = sidebar.classList.contains('collapsed') ? '⇛' : '⇚';
        menuBtn.onclick = () => {
            sidebar.classList.toggle('collapsed');
            menuBtn.innerText = sidebar.classList.contains('collapsed') ? '⇛' : '⇚';
        };
    }

    // --- Експорт JSON ---
    window.exportData = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.data));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `dashboard_data_${state.currentYear}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    //  Додана функція Snapshot (копіювання місяця)
    window.handleSnapshot = () => {
        if(copyFromPreviousMonth()) {
            renderEmployeesTable(); renderProjectsTable();
            alert("Data copied from previous month!");
        } else {
            alert("No data found for previous month.");
        }
    };

    const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    monthSelect.innerHTML = mNames.map((m, i) => `<option value="${i}" ${i===state.currentMonth?'selected':''}>${m}</option>`).join('');
    yearSelect.innerHTML = [2025,2026,2027].map(y => `<option value="${y}" ${y===state.currentYear?'selected':''}>${y}</option>`).join('');

    monthSelect.onchange = (e) => { state.currentMonth = parseInt(e.target.value); renderEmployeesTable(); renderProjectsTable(); };
    yearSelect.onchange = (e) => { state.currentYear = parseInt(e.target.value); renderEmployeesTable(); renderProjectsTable(); };

    navLinks.forEach(link => {
        link.onclick = () => {
            const t = link.getAttribute('data-tab');
            navLinks.forEach(l => l.classList.remove('active')); link.classList.add('active');
            pages.forEach(p => p.style.display = p.id === `${t}-page` ? 'block' : 'none');
        };
    });

    seedDataBtn.onclick = () => {
        const d = getCurrentMonthData();
        const firstNames = ["Oleksandr", "Maria", "Dmytro", "Anna", "Sergiy", "Olena", "Andriy", "Viktoria", "Maksim", "Yulia"];
        const lastNames = ["Kovalenko", "Shevchenko", "Melnik", "Tkachenko", "Bondarenko", "Kravchenko", "Oliynik", "Polischuk", "Marchenko", "Savchenko"];
        const positions = ["Junior", "Middle", "Senior", "Lead", "Architect"];
        const companies = ["Tech Solutions", "Global IT", "SoftServe", "DataArt", "EPAM", "Google", "Startup Inc"];
        const projectNames = ["E-commerce Platform", "Mobile Banking", "AI Chatbot", "Cloud Storage", "ERP System"];

        const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

        const newEmployee = {
            id: Date.now(),
            firstName: getRandom(firstNames),
            lastName: getRandom(lastNames),
            dob: `${1980 + Math.floor(Math.random() * 25)}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`,
            salary: 1000 + Math.floor(Math.random() * 5000),
            position: getRandom(positions),
            vacationDays: []
        };

        const newProject = {
            id: Date.now() + 1,
            company: getRandom(companies),
            name: getRandom(projectNames),
            budget: 20000 + Math.floor(Math.random() * 80000),
            projectCapacity: 1 + Math.floor(Math.random() * 5),
            assignments: []
        };

        d.employees.push(newEmployee);
        d.projects.push(newProject);

        saveState(); 
        renderEmployeesTable(); 
        renderProjectsTable();
    };

    document.getElementById('openAddEmployee').onclick = () => {
        openSidePanel(`
            <h3>New Employee</h3>
            <form id="addE">
                <input type="text" name="f" placeholder="First Name" required minlength="3">
                <input type="text" name="l" placeholder="Last Name" required minlength="3">
                <input type="date" name="d" required>
                <label style="font-size:0.75rem; color:#718096; margin-top:10px; display:block;">Position:</label>
                <select name="p">
                    ${POSITIONS.map(p => `<option value="${p}">${p}</option>`).join('')}
                </select>
                <input type="number" name="s" placeholder="Salary" required style="margin-top:15px;">
                <button type="submit" class="btn-primary" style="width:100%">Create</button>
            </form>`);
        document.getElementById('addE').onsubmit = (e) => {
            e.preventDefault(); const fd = new FormData(e.target);
            if (calculateAge(fd.get('d')) < 18) return alert("Must be 18+");
            getCurrentMonthData().employees.push({ id: Date.now(), firstName: fd.get('f'), lastName: fd.get('l'), dob: fd.get('d'), salary: parseFloat(fd.get('s')), position: fd.get('p'), vacationDays: [] });
            saveState(); closeSidePanel(); renderEmployeesTable();
        };
    };

    document.getElementById('openAddProject').onclick = () => {
        openSidePanel(`<h3>New Project</h3><form id="addP"><input type="text" name="c" placeholder="Company" required minlength="2"><input type="text" name="n" placeholder="Name" required minlength="3"><input type="number" name="b" placeholder="Budget" required><input type="number" name="t" value="1" step="0.1"><button type="submit" class="btn-primary" style="width:100%">Create</button></form>`);
        document.getElementById('addP').onsubmit = (e) => {
            e.preventDefault(); const fd = new FormData(e.target);
            getCurrentMonthData().projects.push({ id: Date.now(), company: fd.get('c'), name: fd.get('n'), budget: parseFloat(fd.get('b')), projectCapacity: parseFloat(fd.get('t')), assignments: [] });
            saveState(); closeSidePanel(); renderProjectsTable();
        };
    };

    overlay.onclick = closeSidePanel;
    renderEmployeesTable(); renderProjectsTable();
});