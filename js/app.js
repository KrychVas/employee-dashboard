import { state } from './state.js';

const monthSelect = document.getElementById('monthSelect');
const yearSelect = document.getElementById('yearSelect');
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const toggleSidebar = document.getElementById('toggleSidebar');
const sidebar = document.getElementById('sidebar');

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

// 1. Initialize Period Selectors (Requirement 13)
function initSelectors() {
    // Fill Months
    months.forEach((month, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = month;
        monthSelect.appendChild(option);
    });

    // Fill Years (2025-2027 as per TAs)
    [2025, 2026, 2027].forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });

    // Set defaults from state
    monthSelect.value = state.currentMonth;
    yearSelect.value = state.currentYear;
}

// 2. Tab Navigation Logic (Requirement 13)
function initNavigation() {
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetTab = link.dataset.tab;

            // Update Active Link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Switch Pages
            pages.forEach(page => {
                page.style.display = page.id === `${targetTab}-page` ? 'block' : 'none';
            });
        });
    });
}

// 3. Sidebar Toggle (Requirement 13)
toggleSidebar.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    toggleSidebar.textContent = sidebar.classList.contains('collapsed') ? '→' : '☰';
});

// Run everything on load
document.addEventListener('DOMContentLoaded', () => {
    initSelectors();
    initNavigation();
    console.log("App initialized with period:", state.currentYear, state.currentMonth);
});

const addEmployeeBtn = document.getElementById('openAddEmployee');
const sidePanel = document.getElementById('side-panel');
const overlay = document.getElementById('overlay');

function openSidePanel(contentHtml) {
    sidePanel.innerHTML = contentHtml;
    sidePanel.classList.add('open');
    overlay.classList.add('active');
}

function closeSidePanel() {
    sidePanel.classList.remove('open');
    overlay.classList.remove('active');
}

addEmployeeBtn.addEventListener('click', () => {
    const formHtml = `
        <h2>Add New Employee</h2>
        <form id="employeeForm">
            <div class="form-group">
                <label>First Name</label>
                <input type="text" id="firstName" name="firstName" required minlength="3" pattern="[A-Za-z]+">
                <span class="error-message">Min 3 letters, only English letters</span>
            </div>
            <div class="form-group">
                <label>Last Name</label>
                <input type="text" id="lastName" name="lastName" required minlength="3" pattern="[A-Za-z]+">
            </div>
            <div class="form-group">
                <label>Date of Birth</label>
                <input type="date" id="dob" name="dob" required>
                <span class="error-message">Must be 18+ years old</span>
            </div>
            <div class="form-group">
                <label>Position</label>
                <select id="position" required>
                    <option value="Junior">Junior</option>
                    <option value="Middle">Middle</option>
                    <option value="Senior">Senior</option>
                    <option value="Lead">Lead</option>
                    <option value="Architect">Architect</option>
                    <option value="Director">Director</option>
                </select>
            </div>
            <div class="form-group">
                <label>Salary</label>
                <input type="number" id="salary" name="salary" required min="1" step="0.01">
            </div>
            <button type="submit" id="submitEmployee" class="btn-primary" disabled>Submit</button>
            <button type="button" class="btn-secondary" onclick="closeSidePanel()">Cancel</button>
        </form>
    `;
    openSidePanel(formHtml);
    initFormValidation(); // Функція для перевірки 18+ років та активації кнопки
});

overlay.addEventListener('click', closeSidePanel);

function initFormValidation() {
    const form = document.getElementById('employeeForm');
    const submitBtn = document.getElementById('submitEmployee');
    const dobInput = document.getElementById('dob');

    form.addEventListener('input', () => {
        const dob = new Date(dobInput.value);
        const age = new Date().getFullYear() - dob.getFullYear();
        const isAdult = age >= 18;

        if (!isAdult) {
            dobInput.setCustomValidity("Must be 18+");
        } else {
            dobInput.setCustomValidity("");
        }

        submitBtn.disabled = !form.checkValidity();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        // Тут ми будемо викликати функцію збереження в State
        console.log("Saving employee...");
        closeSidePanel();
    });
}