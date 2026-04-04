"use client";

import { useEffect, useState, useCallback } from "react";
import { requestJson } from "../lib/api";

interface Task {
  id: string;
  name: string;
  state: "running" | "done" | "failed" | "pending";
  workers: string[];
}

export default function CoordinatorView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const data = await requestJson("/coordinator/tasks");
      setTasks(Array.isArray(data.tasks) ? data.tasks : []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, [loadTasks]);

  return (
    <div className="view coordinator-view">
      <div className="coordinator-shell">
        <div className="panel-card">
          <div className="panel-card-title">Coordinator Hub</div>
          <div className="panel-card-copy">
            Aqui o Chocks coordena os amiguinhos dele (workers) para fazer tarefas difíceis juntas. 👦🤖🦾
          </div>
        </div>

        <div className="task-list">
          {tasks.map((task) => (
            <div key={task.id} className={`panel-card task-item ${task.state}`}>
              <div className="task-header">
                <span className="task-name">{task.name}</span>
                <span className={`task-badge ${task.state}`}>{task.state}</span>
              </div>
              <div className="task-workers">
                {task.workers?.map((w, idx) => (
                  <span key={idx} className="worker-chip">@{w}</span>
                ))}
              </div>
            </div>
          ))}
          {!loading && tasks.length === 0 && (
            <div className="panel-card-copy">Nenhuma tarefa ativa no momento.</div>
          )}
        </div>
      </div>
    </div>
  );
}
