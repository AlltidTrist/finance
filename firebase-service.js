// Синхронизация через Firebase (работает только при настройке firebase-config.js)
const FirebaseService = {
  _initialized: false,
  _auth: null,
  _db: null,
  _unsubscribe: null,

  isConfigured() {
    return typeof FIREBASE_CONFIG !== 'undefined' &&
      FIREBASE_CONFIG?.apiKey &&
      !FIREBASE_CONFIG.apiKey.includes('YOUR_') &&
      !FIREBASE_CONFIG.apiKey.includes('ВАШ_');
  },

  async init() {
    if (!this.isConfigured() || this._initialized) return false;
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
      const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
      const app = initializeApp(FIREBASE_CONFIG);
      this._auth = getAuth(app);
      this._db = getFirestore(app);
      this._initialized = true;
      return true;
    } catch (e) {
      console.warn('Firebase init error:', e);
      return false;
    }
  },

  getAuth() {
    return this._auth;
  },

  getUserId() {
    return this._auth?.currentUser?.uid || null;
  },

  userDocPath() {
    const uid = this.getUserId();
    return uid ? `users/${uid}` : null;
  },

  async signIn(email, password) {
    const { signInWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
    return signInWithEmailAndPassword(this._auth, email, password);
  },

  async signUp(email, password) {
    const { createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js');
    return createUserWithEmailAndPassword(this._auth, email, password);
  },

  async signOut() {
    return this._auth?.signOut();
  },

  onAuthStateChanged(callback) {
    if (!this._auth) return () => {};
    return this._auth.onAuthStateChanged(callback);
  },

  async saveToCloud(transactions, goals, recurringExpenses = [], temki = [], accounts = [], currentAccountId = null, apiKey = null) {
    const path = this.userDocPath();
    if (!this._db || !path) {
      console.warn('Firebase not initialized or no user');
      return;
    }
    const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    console.log('Saving to cloud:', { transactions: transactions.length, goals: goals.length, accounts: accounts.length, currentAccountId });
    await setDoc(doc(this._db, path), { transactions, goals, recurringExpenses, temki, accounts, currentAccountId, apiKey }, { merge: true });
  },

  async loadFromCloud() {
    const path = this.userDocPath();
    if (!this._db || !path) {
      console.warn('Firebase not initialized or no user');
      return { transactions: [], goals: [], recurringExpenses: [], temki: [], accounts: [], currentAccountId: null };
    }
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    const snap = await getDoc(doc(this._db, path));
    const data = snap.data() || {};
    console.log('Loaded from cloud:', { transactions: (data.transactions || []).length, goals: (data.goals || []).length, accounts: (data.accounts || []).length, currentAccountId: data.currentAccountId });
    return {
      transactions: data.transactions || [],
      goals: data.goals || [],
      recurringExpenses: data.recurringExpenses || [],
      temki: data.temki || [],
      accounts: data.accounts || [],
      currentAccountId: data.currentAccountId || null,
      apiKey: data.apiKey || null,
    };
  },

  async subscribeToSync(callback) {
    const path = this.userDocPath();
    if (!this._db || !path) return;
    if (this._unsubscribe) this._unsubscribe();
    const { doc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js');
    this._unsubscribe = onSnapshot(doc(this._db, path), (snap) => {
      const data = snap.data() || {};
      console.log('Sync update:', { transactions: (data.transactions || []).length, accounts: (data.accounts || []).length, currentAccountId: data.currentAccountId });
      callback({
        transactions: data.transactions || [],
        goals: data.goals || [],
        recurringExpenses: data.recurringExpenses || [],
        temki: data.temki || [],
        accounts: data.accounts || [],
        currentAccountId: data.currentAccountId || null
      });
    });
  }
};
