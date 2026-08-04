import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db, doc, onSnapshot } from './firebase';
import { Toaster } from 'react-hot-toast';
import { MessageCircle } from 'lucide-react';
import Login from './pages/Login';
import Inbox from './pages/Inbox';
import Dashboard from './pages/Dashboard';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';
import USOptions from './pages/USOptions';
import News from './pages/News';
import Navbar from './components/Navbar';

import WhatsAppWidget from './components/WhatsAppWidget';

// A simple layout wrapper for public pages
function PublicLayout({ children }) {
  return (
    <>
      <Navbar />
      {children}
      <WhatsAppWidget />
    </>
  );
}

// A protected route wrapper for visitors
function VisitorProtectedRoute({ children }) {
  const isVisitorLoggedIn = localStorage.getItem('visitorName');
  if (!isVisitorLoggedIn) {
    return <Navigate to="/visitor-login" replace />;
  }
  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let docUnsub = null;
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        // If it's a Phone Auth user (customer), ignore them here so LandingPage handles their session
        if (!currentUser.email) {
          setUser(null);
          setLoading(false);
          return;
        }

        // When logged in, listen to their document to enforce deactivation/deletion in real-time
        // Skip this check for the admin since they might not have a document in the users collection
        if (currentUser.email?.toLowerCase() !== 'etegahanalysis@gmail.com') {
          docUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
               const data = docSnap.data();
               if (data.isActive === false) {
                   signOut(auth);
               }
            } else {
               // If document doesn't exist, sign out
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
    return <div className="min-h-screen flex items-center justify-center bg-gray-100">جاري التحميل...</div>;
  }

  const isAdmin = user?.email?.toLowerCase() === 'etegahanalysis@gmail.com';

  return (
    <>
      <Toaster position="top-center" toastOptions={{ duration: 4000, style: { background: '#333', color: '#fff', direction: 'rtl' } }} />
      <BrowserRouter>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to={isAdmin ? "/dashboard" : "/inbox"} /> : <Login />} 
          />
          <Route 
            path="/visitor-login" 
            element={<LandingPage />} 
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
            element={<PublicLayout><Home /></PublicLayout>} 
          />
          <Route 
            path="/home" 
            element={<Navigate to="/" replace />} 
          />
          <Route 
            path="/us-options" 
            element={<VisitorProtectedRoute><PublicLayout><USOptions /></PublicLayout></VisitorProtectedRoute>} 
          />
          <Route 
            path="/news" 
            element={<VisitorProtectedRoute><PublicLayout><News /></PublicLayout></VisitorProtectedRoute>} 
          />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
