import React, { useState } from 'react';
import { Search, X, FolderKanban, ListTodo, Bug, Layers, Users } from 'lucide-react';
import { StorageService } from '../services/storage';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string, entityId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const projects = StorageService.getProjects();
  const tasks = StorageService.getTasks();
  const bugs = StorageService.getBugs();
  const testCases = StorageService.getTestCases();
  const users = StorageService.getUsers();

  const q = query.toLowerCase().trim();

  const matchedProjects = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : [];
  const matchedTasks = q ? tasks.filter((t) => t.title.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)) : [];
  const matchedBugs = q ? bugs.filter((b) => b.title.toLowerCase().includes(q) || b.id.toLowerCase().includes(q)) : [];
  const matchedTestCases = q ? testCases.filter((tc) => tc.title.toLowerCase().includes(q) || tc.id.toLowerCase().includes(q)) : [];
  const matchedMembers = q ? users.filter((u) => u.name.toLowerCase().includes(q)) : [];

  const totalResults =
    matchedProjects.length +
    matchedTasks.length +
    matchedBugs.length +
    matchedTestCases.length +
    matchedMembers.length;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '640px', padding: '24px' }}>
        {/* Search Input Bar */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={20} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Global search projects, tasks, bugs, test cases, members..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{ width: '100%', paddingLeft: '40px', paddingRight: '40px', fontSize: '0.95rem', height: '44px' }}
          />
          <button
            onClick={onClose}
            style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Results Container */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {q && totalResults === 0 && (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              No matches found for "{query}".
            </div>
          )}

          {/* Projects */}
          {matchedProjects.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Projects ({matchedProjects.length})
              </div>
              {matchedProjects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onNavigate('projects', p.id);
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-subtle)',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                  }}
                >
                  <FolderKanban size={15} color="#38bdf8" />
                  <span style={{ fontWeight: 700 }}>{p.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({p.status})</span>
                </div>
              ))}
            </div>
          )}

          {/* Tasks */}
          {matchedTasks.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                QA Tasks ({matchedTasks.length})
              </div>
              {matchedTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    onNavigate('tasks', t.id);
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-subtle)',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ListTodo size={15} color="#38bdf8" />
                    <span><strong>{t.id}:</strong> {t.title}</span>
                  </div>
                  <span className={`badge badge-${t.status.toLowerCase()}`}>{t.status}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bugs */}
          {matchedBugs.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Defects & Bugs ({matchedBugs.length})
              </div>
              {matchedBugs.map((b) => (
                <div
                  key={b.id}
                  onClick={() => {
                    onNavigate('bugs', b.id);
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-subtle)',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.82rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bug size={15} color="#f43f5e" />
                    <span><strong>{b.id.toUpperCase()}:</strong> {b.title}</span>
                  </div>
                  <span className={`badge badge-${b.severity.toLowerCase()}`}>{b.severity}</span>
                </div>
              ))}
            </div>
          )}

          {/* Test Cases */}
          {matchedTestCases.length > 0 && (
            <div>
              <div style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Test Cases ({matchedTestCases.length})
              </div>
              {matchedTestCases.map((tc) => (
                <div
                  key={tc.id}
                  onClick={() => {
                    onNavigate('test-cases', tc.id);
                    onClose();
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '6px',
                    background: 'var(--bg-card-subtle)',
                    marginBottom: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.82rem',
                  }}
                >
                  <Layers size={15} color="#10b981" />
                  <span><strong>{tc.id.toUpperCase()}:</strong> {tc.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
