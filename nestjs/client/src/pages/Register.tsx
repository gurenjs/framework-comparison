import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { FieldError } from '../components/FieldError';
import type { FieldErrors, User } from '../types';

export function Register() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    try {
      const { user } = await api.post<{ user: User }>('/api/auth/register', {
        name,
        email,
        password,
      });
      setUser(user);
      navigate('/');
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors(error.fieldErrors);
        if (error.status !== 422) setFormError(error.message);
      } else {
        setFormError('Something went wrong');
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>
      {formError && <p className="form-error">{formError}</p>}
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <FieldError messages={errors.name} />
      <label>
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <FieldError messages={errors.email} />
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <FieldError messages={errors.password} />
      <button type="submit">Register</button>
    </form>
  );
}
