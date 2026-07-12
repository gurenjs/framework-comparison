import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, ApiError } from '../api';
import { FieldError } from '../components/FieldError';
import type { FieldErrors, PostDetail } from '../types';

/** Create form when no :id param is present, edit form otherwise. */
export function PostEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!id) return;
    void api.get<{ post: PostDetail }>(`/api/posts/${id}`).then(({ post }) => {
      setTitle(post.title);
      setBody(post.body);
    });
  }, [id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError('');
    try {
      const data = { title, body };
      const { post } = id
        ? await api.put<{ post: { id: number } }>(`/api/posts/${id}`, data)
        : await api.post<{ post: { id: number } }>('/api/posts', data);
      navigate(`/posts/${post.id}`);
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
      <h1>{id ? 'Edit post' : 'New post'}</h1>
      {formError && <p className="form-error">{formError}</p>}
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <FieldError messages={errors.title} />
      <label>
        Body
        <textarea
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </label>
      <FieldError messages={errors.body} />
      <button type="submit">{id ? 'Update' : 'Create'}</button>
    </form>
  );
}
