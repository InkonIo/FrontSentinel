// src/pages/AdminPanel.jsx (или src/components/AdminPanel.jsx)
import React, { useState, useEffect } from 'react';
import './AdminPanel.css'; // Создадим этот CSS файл чуть позже

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState(''); // Для изменения роли

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError("Токен не найден. Пожалуйста, войдите снова.");
        setLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8080/api/v1/admin/users', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 403) {
            setError("У вас нет прав для доступа к этой панели (недостаточно прав).");
        } else {
            const errorText = await response.text();
            setError(`Ошибка при получении списка пользователей: ${errorText}`);
        }
        setUsers([]); // Очищаем список при ошибке
        return;
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error("Ошибка при запросе пользователей:", err);
      setError("Не удалось подключиться к серверу.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleEditClick = (user) => {
    setEditingUserId(user.id);
    setNewEmail(user.email);
    // Пароль не редактируем напрямую, его можно только сбросить
    setNewPassword(''); 
    setNewRole(user.role); // Изначально устанавливаем текущую роль пользователя
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setNewEmail('');
    setNewPassword('');
    setNewRole('');
  };

  const handleSaveEmail = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}/email`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newEmail) // Отправляем как JSON-строку
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка при обновлении email: ${errorText}`);
        return;
      }
      alert('Email успешно обновлен!');
      setEditingUserId(null);
      fetchUsers(); // Перезагружаем список пользователей
    } catch (err) {
      console.error("Ошибка при обновлении email:", err);
      setError("Не удалось обновить email.");
    }
  };

  const handleSaveRole = async (userId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newRole: newRole }) // Отправляем объект с полем newRole
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка при обновлении роли: ${errorText}`);
        return;
      }
      alert('Роль успешно обновлена!');
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      console.error("Ошибка при обновлении роли:", err);
      setError("Не удалось обновить роль.");
    }
  };

  const handleResetPassword = async (userId) => {
    if (!newPassword || newPassword.length < 6) { // Пример минимальной длины
      alert("Новый пароль должен быть не менее 6 символов.");
      return;
    }
    if (!window.confirm("Вы уверены, что хотите сбросить пароль для этого пользователя?")) {
        return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPassword) // Отправляем как JSON-строку
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка при сбросе пароля: ${errorText}`);
        return;
      }
      alert('Пароль успешно сброшен!');
      setEditingUserId(null);
      setNewPassword(''); // Очищаем поле пароля
      fetchUsers();
    } catch (err) {
      console.error("Ошибка при сбросе пароля:", err);
      setError("Не удалось сбросить пароль.");
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Вы уверены, что хотите удалить этого пользователя? Это действие необратимо.")) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        setError(`Ошибка при удалении пользователя: ${errorText}`);
        return;
      }
      alert('Пользователь успешно удален!');
      fetchUsers(); // Обновляем список
    } catch (err) {
      console.error("Ошибка при удалении пользователя:", err);
      setError("Не удалось удалить пользователя.");
    }
  };

  if (loading) {
    return <div className="admin-panel-container">Загрузка пользователей...</div>;
  }

  if (error) {
    return <div className="admin-panel-container error-message">Ошибка: {error}</div>;
  }

  return (
    <div className="admin-panel-container">
      <h1>Панель администратора</h1>
      <h2>Управление пользователями</h2>

      {users.length === 0 ? (
        <p>Пользователи не найдены.</p>
      ) : (
        <table className="users-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Email</th>
              <th>Роль</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id}>
                <td>{user.id}</td>
                <td>
                  {editingUserId === user.id ? (
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  ) : (
                    user.email
                  )}
                </td>
                <td>
                  {editingUserId === user.id ? (
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  ) : (
                    user.role
                  )}
                </td>
                <td>
                  {editingUserId === user.id ? (
                    <>
                      <button onClick={() => handleSaveEmail(user.id)} className="action-btn save-btn">Сохранить Email</button>
                      <button onClick={() => handleSaveRole(user.id)} className="action-btn save-btn">Сохранить Роль</button>
                      <input
                        type="password"
                        placeholder="Новый пароль"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="password-input"
                      />
                      <button onClick={() => handleResetPassword(user.id)} className="action-btn reset-password-btn">Сбросить Пароль</button>
                      <button onClick={handleCancelEdit} className="action-btn cancel-btn">Отмена</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => handleEditClick(user)} className="action-btn edit-btn">Редактировать</button>
                      <button onClick={() => handleDeleteUser(user.id)} className="action-btn delete-btn">Удалить</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}