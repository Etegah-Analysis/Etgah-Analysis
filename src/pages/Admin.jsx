import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Trash2 } from 'lucide-react';
import { db, collection, getDocs, query, orderBy, deleteDoc, doc } from '../firebase';

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const usersList = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(usersList);
    } catch (error) {
      console.error("Error fetching users: ", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const deleteUser = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
      try {
        await deleteDoc(doc(db, 'users', id));
        setUsers(users.filter(user => user.id !== id));
      } catch (error) {
        console.error("Error deleting user: ", error);
        alert('حدث خطأ أثناء الحذف.');
      }
    }
  };

  return (
    <div className="admin-page container" style={{ padding: '4rem 0' }}>
      <div className="flex justify-between items-center mb-8">
        <h1>لوحة تحكم الإدارة - طلبات التسجيل</h1>
        <button onClick={fetchUsers} className="button" style={{ fontSize: '0.9rem' }}>
          تحديث البيانات
        </button>
      </div>

      <div className="card glass" style={{ padding: '0', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>جاري تحميل البيانات...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-light)' }}>
            <User size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>لا يوجد مستخدمون مسجلون حالياً.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 188, 212, 0.1)', borderBottom: '1px solid var(--border-blue)' }}>
                  <th style={{ padding: '15px' }}>#</th>
                  <th style={{ padding: '15px' }}>البريد الإلكتروني</th>
                  <th style={{ padding: '15px' }}>رقم الهاتف</th>
                  <th style={{ padding: '15px' }}>الدولة</th>
                  <th style={{ padding: '15px' }}>تاريخ التسجيل</th>
                  <th style={{ padding: '15px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.3s' }} className="table-row-hover">
                    <td style={{ padding: '15px' }}>{index + 1}</td>
                    <td style={{ padding: '15px' }}>
                      <div className="flex items-center gap-2">
                        <Mail size={16} color="var(--primary-blue)" />
                        {user.email}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <div className="flex items-center gap-2" style={{ direction: 'ltr', justifyContent: 'flex-end' }}>
                        {user.phone}
                        <Phone size={16} color="var(--primary-blue)" />
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>{user.country === '+966' ? 'السعودية 🇸🇦' : 'مصر 🇪🇬'}</td>
                    <td style={{ padding: '15px' }}>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} color="var(--primary-blue)" />
                        {user.date}
                      </div>
                    </td>
                    <td style={{ padding: '15px' }}>
                      <button 
                        onClick={() => deleteUser(user.id)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer' }}
                        title="حذف"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .table-row-hover:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        th { font-weight: 600; color: var(--primary-blue); }
        td { color: var(--text-color); font-size: 0.95rem; }
      `}} />
    </div>
  );
}
