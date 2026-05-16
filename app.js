class StudyApp {
    constructor() {
        this.characters = [];
        // Test mode queue (New + Reviews)
        this.sessionQueue = [];
        // Learn mode queue (Just New cards initially)
        this.learnQueue = []; 
        
        this.currentCard = null;
        this.currentMode = null; // 'learn' or 'test'
        
        this.NEW_CARDS_PER_DAY = 11;

        this.views = {
            dashboard: document.getElementById('dashboard'),
            learn: document.getElementById('learn'),
            session: document.getElementById('session'),
            summary: document.getElementById('summary')
        };
        
        this.canvas = document.getElementById('draw-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        
        this.loadData().then(() => {
            this.init();
        });
    }

    async loadData() {
        try {
            const res = await fetch('characters.json');
            this.characters = await res.json();
        } catch (err) {
            console.error("Failed to load characters.json", err);
            this.characters = [];
        }
    }

    init() {
        this.loadProgress();
        this.bindEvents();
        this.updateDashboard();
        window.addEventListener('resize', () => {
            if (!this.views.session.classList.contains('hidden')) {
                this.resizeCanvas();
            }
        });
    }

    loadProgress() {
        const saved = localStorage.getItem('hanja_progress');
        if (saved) {
            this.progress = JSON.parse(saved);
        } else {
            this.progress = {
                day: 1,
                lastStudyDate: null,
                learned: [], 
                reviews: {} 
            };
        }
        
        const today = new Date().toDateString();
        if (this.progress.lastStudyDate && this.progress.lastStudyDate !== today) {
            this.progress.day++;
        }
    }

    saveProgress() {
        localStorage.setItem('hanja_progress', JSON.stringify(this.progress));
    }

    buildSessionQueues() {
        this.sessionQueue = [];
        this.learnQueue = [];
        const today = new Date().getTime();
        
        // 1. Add due reviews to Test Queue ONLY
        for (let idx in this.progress.reviews) {
            if (this.progress.reviews[idx] <= today) {
                this.sessionQueue.push({ idx: parseInt(idx), type: 'review' });
            }
        }
        
        // 2. Find new cards for the day
        let newCount = 0;
        for (let i = 0; i < this.characters.length; i++) {
            if (newCount >= this.NEW_CARDS_PER_DAY) break;
            
            if (!this.progress.learned.includes(i) && !this.progress.reviews[i]) {
                const card = { idx: i, type: 'new' };
                // New cards go to Learn Queue FIRST, then they are also added to Test Queue
                this.learnQueue.push(card);
                this.sessionQueue.push(card);
                newCount++;
            }
        }
        
        // Shuffle the test queue
        this.sessionQueue.sort(() => Math.random() - 0.5);
    }

    updateDashboard() {
        document.getElementById('stat-day').innerText = this.progress.day;
        document.getElementById('stat-learned').innerText = this.progress.learned.length;
        
        this.buildSessionQueues();
        document.getElementById('stat-due').innerText = this.sessionQueue.length;
    }

    switchView(viewId) {
        Object.values(this.views).forEach(el => el.classList.add('hidden'));
        this.views[viewId].classList.remove('hidden');
    }

    startSession() {
        if (this.sessionQueue.length === 0) {
            this.buildSessionQueues();
        }
        
        if (this.sessionQueue.length === 0) {
            alert("No cards due today! Add more Hanja to your database.");
            return;
        }

        this.progress.lastStudyDate = new Date().toDateString();
        this.saveProgress();

        // If there are new cards to learn, go to Learn View first
        if (this.learnQueue.length > 0) {
            this.learnTotal = this.learnQueue.length;
            this.startLearnMode();
        } else {
            // Only reviews due, skip to Test View
            this.startTestMode();
        }
    }

    /* Learning Mode */
    startLearnMode() {
        this.switchView('learn');
        this.showNextLearnCard();
    }

    showNextLearnCard() {
        if (this.learnQueue.length === 0) {
            // Done learning, move to testing
            this.startTestMode();
            return;
        }

        const cardRef = this.learnQueue.shift();
        const charData = this.characters[cardRef.idx];

        document.getElementById('learn-progress').innerText = 
            `New: ${this.learnTotal - this.learnQueue.length} / ${this.learnTotal}`;
        
        document.getElementById('learn-hanzi').innerText = charData.hz;
        document.getElementById('learn-kr-meaning').innerText = charData.kr_meaning || charData.tr || '';
        document.getElementById('learn-kr-sound').innerText = charData.kr_sound || charData.py || '';
        
        const examplesEl = document.getElementById('learn-examples');
        examplesEl.innerHTML = '';
        if (charData.examples && charData.examples.length > 0) {
            charData.examples.forEach(ex => {
                const li = document.createElement('li');
                li.innerHTML = `<span class="ex-word">${ex.word}</span><span class="ex-def">${ex.def}</span>`;
                examplesEl.appendChild(li);
            });
        }
    }

    /* Testing Mode */
    startTestMode() {
        this.switchView('session');
        this.testTotal = this.sessionQueue.length;
        
        // Ensure canvas respects current DOM size
        setTimeout(() => this.resizeCanvas(), 50);
        
        this.showNextTestCard();
    }

    showNextTestCard() {
        if (this.sessionQueue.length === 0) {
            this.updateDashboard();
            this.switchView('summary');
            return;
        }

        this.currentCard = this.sessionQueue.shift();
        const charData = this.characters[this.currentCard.idx];

        // Testing UI now shows KR meaning and sound
        document.getElementById('card-kr-meaning').innerText = charData.kr_meaning || charData.tr || '';
        document.getElementById('card-kr-sound').innerText = charData.kr_sound || charData.py || '';
        document.getElementById('card-answer').innerText = charData.hz;
        
        document.getElementById('session-progress').innerText = 
            `${this.testTotal - this.sessionQueue.length} / ${this.testTotal}`;

        this.resetTestCardState();
    }

    resetTestCardState() {
        document.getElementById('card-answer').classList.add('hidden');
        document.getElementById('btn-reveal').classList.remove('hidden');
        document.getElementById('grade-buttons').classList.add('hidden');
        document.getElementById('canvas-overlay').classList.remove('hidden');
        this.clearCanvas();
    }

    revealAnswer() {
        document.getElementById('card-answer').classList.remove('hidden');
        document.getElementById('btn-reveal').classList.add('hidden');
        document.getElementById('grade-buttons').classList.remove('hidden');
    }

    gradeCard(passed) {
        const idx = this.currentCard.idx;
        const now = new Date().getTime();
        const ONE_DAY = 24 * 60 * 60 * 1000;
        
        if (passed) {
            if (!this.progress.learned.includes(idx)) {
                this.progress.learned.push(idx);
            }
            
            let nextReview = now + ONE_DAY;
            if (this.progress.reviews[idx]) {
                nextReview = now + (ONE_DAY * 3); 
            }
            this.progress.reviews[idx] = nextReview;
        } else {
            this.sessionQueue.push(this.currentCard);
            this.testTotal++;
            this.progress.reviews[idx] = now + (1000 * 60 * 60); 
        }
        
        this.saveProgress();
        this.showNextTestCard();
    }

    /* Canvas Drawing Logic */
    resizeCanvas() {
        if(!this.canvas.parentElement) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.ctx.strokeStyle = '#f8fafc';
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        document.getElementById('canvas-overlay').classList.remove('hidden');
    }

    startDrawing(e) {
        this.isDrawing = true;
        document.getElementById('canvas-overlay').classList.add('hidden');
        const pos = this.getPointerPos(e);
        this.ctx.beginPath();
        this.ctx.moveTo(pos.x, pos.y);
        e.preventDefault();
    }

    draw(e) {
        if (!this.isDrawing) return;
        const pos = this.getPointerPos(e);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        e.preventDefault();
    }

    stopDrawing() {
        this.isDrawing = false;
        this.ctx.closePath();
    }

    getPointerPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }

    bindEvents() {
        document.getElementById('btn-start').addEventListener('click', () => this.startSession());
        
        // Quitting handlers
        document.getElementById('btn-quit').addEventListener('click', () => {
            if(confirm('Quit session? Progress is saved.')) {
                this.updateDashboard();
                this.switchView('dashboard');
            }
        });
        document.getElementById('btn-learn-quit').addEventListener('click', () => {
             if(confirm('Quit learning?')) {
                this.updateDashboard();
                this.switchView('dashboard');
            }
        });
        
        document.getElementById('btn-home').addEventListener('click', () => {
            this.updateDashboard();
            this.switchView('dashboard');
        });
        
        // Learn Action
        document.getElementById('btn-learn-next').addEventListener('click', () => this.showNextLearnCard());

        // Test Actions
        document.getElementById('btn-reveal').addEventListener('click', () => this.revealAnswer());
        document.getElementById('btn-pass').addEventListener('click', () => this.gradeCard(true));
        document.getElementById('btn-fail').addEventListener('click', () => this.gradeCard(false));
        document.getElementById('btn-clear').addEventListener('click', () => this.clearCanvas());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Learn View
            if (!this.views.learn.classList.contains('hidden')) {
                if (e.code === 'Space' || e.code === 'Enter') {
                    this.showNextLearnCard();
                }
            }
            // Test View
            else if (!this.views.session.classList.contains('hidden')) {
                if (e.code === 'Space' || e.code === 'Enter') {
                    if (!document.getElementById('btn-reveal').classList.contains('hidden')) {
                        this.revealAnswer();
                    }
                } else if (e.code === 'Digit1') {
                    if (!document.getElementById('grade-buttons').classList.contains('hidden')) {
                        this.gradeCard(false);
                    }
                } else if (e.code === 'Digit2' || e.code === 'Digit3') {
                    if (!document.getElementById('grade-buttons').classList.contains('hidden')) {
                        this.gradeCard(true);
                    }
                }
            }
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());

        this.canvas.addEventListener('touchstart', (e) => this.startDrawing(e), {passive: false});
        this.canvas.addEventListener('touchmove', (e) => this.draw(e), {passive: false});
        this.canvas.addEventListener('touchend', () => this.stopDrawing());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new StudyApp();
});
