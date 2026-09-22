const { Client } = require('pg');
const c = new Client({connectionString: 'postgresql://postgres:postgres@localhost:5432/crm'});
c.connect().then(()=> {
  return c.query(`SELECT DISTINCT
    COALESCE(u.id, em.id) AS id,
    COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email) AS name,
    COALESCE(u.email, em.email) AS email,
    COALESCE(u.department, em.department) AS department,
    COALESCE(u.designation, em.designation) AS designation,
    COALESCE(u.is_active, TRUE) AS is_active,
    (u.id IS NULL OR u.name IS NULL OR u.name = '') AS is_pending
  FROM employee_master em
  FULL OUTER JOIN users u ON LOWER(u.email) = LOWER(em.email)
  LEFT JOIN roles r ON r.id = COALESCE(u.role_id, em.role_id)
  LEFT JOIN user_roles ur ON ur.user_id = u.id
  LEFT JOIN roles ur_r ON ur_r.id = ur.role_id
  LEFT JOIN employee_roles er ON er.employee_id = em.id
  LEFT JOIN roles er_r ON er_r.id = er.role_id
  WHERE COALESCE(u.is_active, TRUE) = TRUE
  ORDER BY LOWER(COALESCE(NULLIF(u.name, ''), NULLIF(em.name, ''), u.email, em.email)) ASC`);
}).then(console.log).catch(console.error).finally(()=>c.end());
