import axios from'axios';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'http://localhost:5000/api',timeout:15000});
api.interceptors.request.use(c=>{const t=sessionStorage.getItem('mota_admin_token');if(t)c.headers.Authorization=`Bearer ${t}`;return c});
export const adminApi={stats:()=>api.get('/admin/stats'),users:()=>api.get('/admin/users'),drivers:()=>api.get('/admin/drivers'),registrations:()=>api.get('/admin/registrations'),transactions:()=>api.get('/admin/paypack/transactions'),roles:()=>api.get('/roles'),audits:()=>api.get('/audit-logs'),updateRole:(id:string,permissions:string[])=>api.put(`/roles/${id}/permissions`,{permissions})};
