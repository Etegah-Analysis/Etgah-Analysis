import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, doc, onSnapshot } from './firebase';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Dashboard from './pages/Dashboard';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const adminEmails = ['etegahanalysis@gmail.com', 'mohamed.gamal.work0@gmail.com', 'admin@etegah.com'];

  useEffect(() => {
    let docUnsub = null;
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (!currentUser.email) {
          setUser(null);
          setLoading(false);
          return;
        }

        if (!adminEmails.includes(currentUser.email?.toLowerCase())) {
          docUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
               const data = docSnap.data();
               if (data.isActive === false) {
                   signOut(auth);
               }
            } else {
               signOut(auth);
            }
          });
        }
      } else {
        if (docUnsub) {
          docUnsub();
          docUnsub = null;
        }
      }
      
      setUser(currentUser);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (docUnsub) docUnsub();
    };
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 font-bold text-gray-700">جاري التحميل...</div>;
  }

  const isAdmin = adminEmails.includes(user?.email?.toLowerCase());

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', direction: 'rtl' } }} />
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" /> : <Login />} 
          />
          <Route 
            path="/inbox" 
            element={user ? <Inbox /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/dashboard" 
            element={user ? <Dashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/" 
            element={<Navigate to="/login" replace />} 
          />
          <Route 
            path="*" 
            element={<Navigate to="/login" replace />} 
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
