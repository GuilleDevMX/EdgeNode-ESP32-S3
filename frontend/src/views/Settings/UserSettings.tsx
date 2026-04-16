// src/views/Settings/UserSettings.tsx
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api/client';
import type { User } from '../../interfaces/user';
import { BlockLoader } from '../../components/Skeletons';

const UserSettings = () => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState<any>({
    username: '',
    password: '',
    role: 'viewer',
  });

  useEffect(() => {
    apiFetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        setUsersList(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(newUser),
    });
    toast.success('Usuario aprovisionado con éxito.');
    setNewUser({ username: '', password: '', role: 'viewer' });
    setUsersList((prev) => [...prev, { ...newUser, last_login: 'Nunca' }]);
  };

  return (
    <div className='max-w-4xl animate-fade-in'>
      <div className='flex justify-between items-center mb-6'>
        <h3 className='text-xl font-bold text-text-primary'>
          Control de Acceso Basado en Roles (RBAC)
        </h3>
        <span className='bg-purple-50 text-purple-700 border border-purple-200 text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1'>
          <svg className='w-3 h-3' fill='currentColor' viewBox='0 0 20 20'>
            <path d='M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z'></path>
          </svg>
          Multi-Tenant Activo
        </span>
      </div>

      <div className='space-y-8'>
        {/* 1. LISTA DE USUARIOS ACTUALES */}
        <section className='bg-panel p-0 rounded-lg border border-border-color overflow-hidden shadow-sm'>
          <div className='bg-app px-6 py-4 border-b border-border-color flex justify-between items-center'>
            <div className='flex items-center gap-2'>
              <svg
                className='w-5 h-5 text-text-primary'
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'
                ></path>
              </svg>
              <h4 className='text-lg font-bold text-text-primary'>
                Directorio de Usuarios
              </h4>
            </div>
            <span className='text-xs text-muted font-semibold'>
              Max. 5 Usuarios Adicionales
            </span>
          </div>

          <div className='overflow-x-auto'>
            <table className='w-full text-left border-collapse'>
              <thead>
                <tr className='bg-panel text-muted text-xs uppercase tracking-wider border-b border-border-color'>
                  <th className='px-6 py-3 font-semibold'>Usuario</th>
                  <th className='px-6 py-3 font-semibold'>Rol Asignado</th>
                  <th className='px-6 py-3 font-semibold'>Último Acceso</th>
                  <th className='px-6 py-3 font-semibold text-right'>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className='p-0'>
                      <BlockLoader />
                    </td>
                  </tr>
                ) : usersList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className='px-6 py-8 text-center text-sm text-muted font-semibold'
                    >
                      No hay usuarios registrados.
                    </td>
                  </tr>
                ) : (
                  usersList.map((user, idx) => (
                    <tr
                      key={idx}
                      className='hover:bg-indigo-50/50 hover:text-secundary transition-colors'
                    >
                      <td className='px-6 py-4 font-bold text-text-primary'>
                        {user.username}
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`border text-xs px-2 py-1 rounded font-bold ${user.role === 'admin' ? 'bg-red-50 text-red-700 border-red-200' : user.role === 'operator' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-700 border-gray-200'}`}
                        >
                          {user.role === 'admin'
                            ? 'Root'
                            : user.role === 'operator'
                              ? 'Operador'
                              : 'Visor'}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-sm text-muted'>
                        {user.last_login || 'Desconocido'}
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <button
                          className={`transition-colors ${user.role === 'admin' ? 'text-gray-400 cursor-not-allowed' : 'text-red-500 hover:text-red-700'}`}
                          title={
                            user.role === 'admin'
                              ? 'El usuario Root no puede ser eliminado'
                              : 'Revocar Acceso'
                          }
                          disabled={user.role === 'admin'}
                          onClick={async () => {
                            if (
                              user.role !== 'admin' &&
                              window.confirm(
                                `¿Seguro que desea revocar el acceso al usuario ${user.username}?`,
                              )
                            ) {
                              await apiFetch(`/api/users?id=${user.id}`, {
                                method: 'DELETE',
                              });
                              setUsersList((prev) =>
                                prev.filter((u) => u.id !== user.id),
                              );
                              toast.success('Usuario eliminado.');
                            }
                          }}
                        >
                          <svg
                            className='w-5 h-5 inline'
                            fill='none'
                            stroke='currentColor'
                            viewBox='0 0 24 24'
                          >
                            <path
                              strokeLinecap='round'
                              strokeLinejoin='round'
                              strokeWidth='2'
                              d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                            ></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. CREACIÓN DE NUEVO USUARIO */}
        <section className='card p-6'>
          <div className='flex items-center gap-2 mb-4 border-b border-border-color pb-2'>
            <svg
              className='w-5 h-5 text-orange-accent'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
              ></path>
            </svg>
            <h4 className='text-lg font-bold text-text-primary'>
              Aprovisionar Nueva Identidad
            </h4>
          </div>

          <form
            className='grid grid-cols-1 md:grid-cols-3 gap-4'
            onSubmit={handleAddUser}
          >
            <div>
              <label className='label-field'>Nombre de Usuario</label>
              <input
                type='text'
                value={newUser.username}
                onChange={(e) =>
                  setNewUser({ ...newUser, username: e.target.value })
                }
                placeholder='Ej. analista_datos'
                className='input-field'
                required
              />
            </div>
            <div>
              <label className='label-field'>Contraseña Inicial</label>
              <input
                type='password'
                value={newUser.password}
                onChange={(e) =>
                  setNewUser({ ...newUser, password: e.target.value })
                }
                placeholder='Mínimo 8 caracteres'
                className='input-field'
                required
              />
            </div>
            <div>
              <label className='label-field'>Nivel de Privilegio</label>
              <select
                value={newUser.role}
                onChange={(e) =>
                  setNewUser({ ...newUser, role: e.target.value as any })
                }
                className='input-field'
              >
                <option value='viewer'>Visor (Solo Lectura)</option>
                <option value='operator'>Operador (Acceso Limitado)</option>
                <option value='admin'>Administrador (Acceso Total)</option>
              </select>
            </div>
            <div className='md:col-span-3 flex justify-end mt-2'>
              <button
                type='submit'
                className='btn btn-primary flex items-center gap-2'
              >
                <svg
                  className='w-4 h-4'
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M12 6v6m0 0v6m0-6h6m-6 0H6'
                  ></path>
                </svg>
                Registrar Usuario en NVS
              </button>
            </div>
          </form>
        </section>

        {/* 3. MATRIZ DE PERMISOS (RBAC Info) */}
        <section className='card p-6'>
          <div className='flex items-center gap-2 mb-4 border-b border-border-color pb-2 '>
            <svg
              viewBox='0 0 24 24'
              stroke='currentColor'
              fill='none'
              className='w-5 h-5 text-orange-accent'
              xmlns='http://www.w3.org/2000/svg'
            >
              <g id='SVGRepo_bgCarrier' stroke-width='0'></g>
              <g
                id='SVGRepo_tracerCarrier'
                stroke-linecap='round'
                stroke-linejoin='round'
              ></g>
              <g id='SVGRepo_iconCarrier'>
                {' '}
                <path
                  d='M11 21H4C4 17.4735 6.60771 14.5561 10 14.0709M19.8726 15.2038C19.8044 15.2079 19.7357 15.21 19.6667 15.21C18.6422 15.21 17.7077 14.7524 17 14C16.2923 14.7524 15.3578 15.2099 14.3333 15.2099C14.2643 15.2099 14.1956 15.2078 14.1274 15.2037C14.0442 15.5853 14 15.9855 14 16.3979C14 18.6121 15.2748 20.4725 17 21C18.7252 20.4725 20 18.6121 20 16.3979C20 15.9855 19.9558 15.5853 19.8726 15.2038ZM15 7C15 9.20914 13.2091 11 11 11C8.79086 11 7 9.20914 7 7C7 4.79086 8.79086 3 11 3C13.2091 3 15 4.79086 15 7Z'
                  stroke='#000000'
                  stroke-width='2'
                  stroke-linecap='round'
                  stroke-linejoin='round'
                ></path>{' '}
              </g>
            </svg>
            <h4 className='text-lg font-bold text-text-primary'>
              Matriz de Permisos del Sistema
            </h4>
          </div>
          <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm'>
            <div className='card-user-role'>
              <p className='font-bold text-red-700 mb-1'>Root / Admin</p>
              <ul className='text-text-secondary space-y-1 list-disc list-inside'>
                <li>Gestión de Red y WiFi</li>
                <li>Rotación de llaves JWT</li>
                <li>Gestión de usuarios</li>
                <li>Formateo de Base de Datos</li>
              </ul>
            </div>
            <div className='card-user-role'>
              <p className='font-bold text-blue-700 mb-1'>Operador</p>
              <ul className='text-text-secondary space-y-1 list-disc list-inside'>
                <li>Descarga de Dataset (CSV)</li>
                <li>Calibración de Sensores</li>
                <li>Visualización de Dashboard</li>
              </ul>
            </div>
            <div className='card-user-role'>
              <p className='font-bold text-gray-700 mb-1'>Visor</p>
              <ul className='text-text-secondary space-y-1 list-disc list-inside'>
                <li>Visualización de Dashboard en tiempo real</li>
                <li>Estado de recursos (SRAM/Uptime)</li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default UserSettings;
