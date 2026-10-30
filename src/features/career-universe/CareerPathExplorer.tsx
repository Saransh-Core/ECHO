import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, BriefcaseBusiness, Check, CheckCircle2, Circle, GitCompareArrows, Hand, RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import type { Career, SkillDefinition } from '../../services/careerRepository';
import { listRoadmaps, updateRoadmapTaskStatus, type RoadmapSummary, type RoadmapTask } from '../../services/roadmapRepository';
import { loadSkillEvidence, type SkillEvidence } from '../../services/skillEvidenceRepository';
import { matchCareer } from '../careers/matching';
import type { Dimension } from '../assessment/riasec';

type NodeType = 'career' | 'skill' | 'task' | 'project';

type PathNode = {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  status: 'completed' | 'in_progress' | 'not_started' | 'blocked' | 'evidenced' | 'unknown';
  x: number;
  y: number;
  z: number;
  skillId?: string;
  task?: RoadmapTask;
};

type Props = {
  careers: Career[];
  skills: SkillDefinition[];
  userId?: string;
  riasecScores?: Partial<Record<Dimension, number | null>>;
  profileInterests?: string[];
  onChooseCareer?: (careerId: string) => void;
};

const statusLabel = {
  completed: 'Completed',
  in_progress: 'In progress',
  not_started: 'Not started',
  blocked: 'Blocked by prerequisite',
  evidenced: 'Evidence recorded',
  unknown: 'No evidence recorded',
};

export function CareerPathExplorer({
  careers,
  skills,
  userId,
  riasecScores,
  profileInterests,
  onChooseCareer,
}: Props) {
  const [careerId, setCareerId] = useState(careers[0]?.id || '');
  const [roadmaps, setRoadmaps] = useState<RoadmapSummary[]>([]);
  const [roadmapId, setRoadmapId] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | NodeType>('all');
  const [selectedId, setSelectedId] = useState('');
  const [listView, setListView] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!!userId);
  const [evidence, setEvidence] = useState<SkillEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(!!userId);
  const [success, setSuccess] = useState('');
  const [evidenceError, setEvidenceError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [taskSaving, setTaskSaving] = useState(false);
  const [comparePaths, setComparePaths] = useState(false);
  const [rotation, setRotation] = useState({ x: -9, y: 14 });
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'rotate' | 'pan'>('rotate');
  const [stageWidth, setStageWidth] = useState(900);

  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const career = careers.find(item => item.id === careerId) || careers[0];

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      setStageWidth(current => Math.abs(current - width) > 4 ? width : current);
    });

    observer.observe(stage);
    return () => observer.disconnect();
  }, [listView]);

  useEffect(() => {
    setCareerId(current =>
      careers.some(item => item.id === current) ? current : careers[0]?.id || ''
    );
  }, [careers]);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setRoadmaps([]);
      try {
        setRoadmaps(JSON.parse(localStorage.getItem('aayam-roadmaps:demo') || '[]') as RoadmapSummary[]);
      } catch {
        setRoadmaps([]);
      }
      setLoading(false);
      return;
    }

    setLoading(true);

    listRoadmaps(userId)
      .then(rows => {
        if (active) {
          setRoadmaps(rows);
          setError('');
        }
      })
      .catch(problem => {
        if (active) {
          setError(problem instanceof Error ? problem.message : 'Saved learning paths could not be loaded.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, reloadVersion]);

  useEffect(() => {
    let active = true;

    if (!userId) {
      setEvidence([]);
      setEvidenceLoading(false);
      return;
    }

    setEvidence([]);
    setEvidenceLoading(true);

    loadSkillEvidence(userId)
      .then(rows => {
        if (active) {
          setEvidence(rows);
          setEvidenceError('');
        }
      })
      .catch(problem => {
        if (active) {
          const message = problem instanceof Error
            ? problem.message
            : 'Skill evidence could not be loaded.';
          setEvidenceError(message);
          setError(message);
        }
      })
      .finally(() => {
        if (active) setEvidenceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [userId, reloadVersion]);

  const careerRoadmaps = roadmaps.filter(
    item => !career || item.careerId === career.id
  );

  const roadmap = careerRoadmaps.find(item => item.id === roadmapId) || careerRoadmaps[0];

  const match = career
    ? matchCareer(career, {
        riasecScores,
        profileInterests,
        evidencedSkillIds: evidence.map(item => item.skill_id),
        skillEvidenceLoaded: !userId || (!evidenceLoading && !evidenceError),
      })
    : null;

  const nodes = useMemo<PathNode[]>(() => {
    if (!career) return [];

    const required = career.skillRequirements;
    const stacked = stageWidth < 480;
    const columns = stageWidth >= 760 ? 2 : 1;
    const split = Math.ceil(required.length / columns);

    const slot = (index: number, count: number) =>
      count <= 1 ? 50 : 12 + index * (76 / (count - 1));

    const skillNodes: PathNode[] = required.map((item, index) => {
      const column = columns === 1 || index < split ? 0 : 1;
      const row = column === 0 ? index : index - split;
      const rowsInColumn = column === 0 ? split : required.length - split;
      const catalog = skills.find(skill => skill.id === item.id);
      const hasEvidence = evidence.some(record => record.skill_id === item.id);

      return {
        id: `skill:${item.id}`,
        skillId: item.id,
        label: item.name,
        type: 'skill',
        description: item.notes || catalog?.description || 'No catalog description is available.',
        status: hasEvidence ? 'evidenced' : 'unknown',
        x: stacked ? 50 : columns === 2 ? (column === 0 ? 35 : 65) : 50,
        y: stacked
          ? slot(index + 1, 1 + required.length + (roadmap?.tasks.length || 0))
          : slot(row, rowsInColumn),
        z: 0,
      };
    });

    const tasks = roadmap?.tasks || [];

    const taskNodes: PathNode[] = tasks.map((task, index) => {
      const dependencies = task.depends_on
        .map(key => tasks.find(item => item.client_key === key))
        .filter((item): item is RoadmapTask => !!item);

      const blocked = task.status !== 'completed'
        && dependencies.some(item => item.status !== 'completed');

      return {
        id: `task:${task.id}`,
        label: task.title,
        type: task.task_type === 'project' ? 'project' : 'task',
        description: task.description,
        status: task.status === 'completed'
          ? 'completed'
          : blocked
            ? 'blocked'
            : task.status === 'in_progress'
              ? 'in_progress'
              : 'not_started',
        x: stacked ? 50 : 90,
        y: stacked
          ? slot(1 + required.length + index, 1 + required.length + tasks.length)
          : slot(index, tasks.length),
        z: 0,
        skillId: task.skill_id,
        task,
      };
    });

    return [
      {
        id: `career:${career.id}`,
        label: career.name,
        type: 'career',
        description: career.desc,
        status: 'unknown',
        x: stacked ? 50 : 10,
        y: stacked ? slot(0, 1 + required.length + tasks.length) : 50,
        z: 0,
      },
      ...skillNodes,
      ...taskNodes,
    ];
  }, [career, evidence, roadmap, skills, stageWidth]);

  const visibleNodes = nodes.filter(
    node =>
      (filter === 'all' || node.type === filter) &&
      `${node.label} ${node.description}`.toLowerCase().includes(search.toLowerCase())
  );

  const selected =
    visibleNodes.find(node => node.id === selectedId) ||
    nodes.find(node => node.id === selectedId) ||
    nodes[0];

  const edges = useMemo(() => {
    if (!career) return [];

    const relations: [string, string][] = [];
    const careerNode = `career:${career.id}`;

    for (const requirement of career.skillRequirements) {
      relations.push([careerNode, `skill:${requirement.id}`]);
    }

    for (const task of roadmap?.tasks || []) {
      if (task.skill_id) {
        relations.push([`task:${task.id}`, `skill:${task.skill_id}`]);
      }

      for (const dependency of task.depends_on) {
        const parent = roadmap?.tasks.find(item => item.client_key === dependency);
        if (parent) {
          relations.push([`task:${task.id}`, `task:${parent.id}`]);
        }
      }
    }

    return relations;
  }, [career, roadmap]);

  const selectNode = (node: PathNode) => setSelectedId(node.id);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button')) return;

    drag.current = {
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;

    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;

    if (Math.abs(dx) + Math.abs(dy) > 2) {
      drag.current.moved = true;
    }

    if (drag.current.moved) {
      if (interactionMode === 'pan') {
        setPan(current => ({
          x: current.x + dx,
          y: current.y + dy,
        }));
      } else {
        setRotation(current => ({
          x: Math.max(-32, Math.min(32, current.x - dy * 0.25)),
          y: current.y + dx * 0.3,
        }));
      }
    }

    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
  };

  const resetView = () => {
    setRotation({ x: -9, y: 14 });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const focusSelected = () => {
    if (!selected) return;

    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;

    setZoom(1.08);

    setPan({
      x: ((50 - selected.x) / 100) * bounds.width,
      y: ((50 - selected.y) / 100) * bounds.height,
    });
  };

  const toggleTask = async (task: RoadmapTask) => {
    if (!roadmap) return;

    const nextStatus = task.status === 'completed' ? 'upcoming' : 'completed';

    setTaskSaving(true);
    setError('');
    setSuccess('');

    try {
      if (userId) {
        await updateRoadmapTaskStatus(userId, roadmap.id, task.id, nextStatus);
      } else {
        const rows = JSON.parse(
          localStorage.getItem('aayam-roadmaps:demo') || '[]'
        ) as RoadmapSummary[];

        localStorage.setItem(
          'aayam-roadmaps:demo',
          JSON.stringify(
            rows.map(row =>
              row.id === roadmap.id
                ? {
                    ...row,
                    updatedAt: new Date().toISOString(),
                    tasks: row.tasks.map(item =>
                      item.id === task.id ? { ...item, status: nextStatus } : item
                    ),
                  }
                : row
            )
          )
        );
      }

      setRoadmaps(current =>
        current.map(row =>
          row.id === roadmap.id
            ? {
                ...row,
                updatedAt: new Date().toISOString(),
                tasks: row.tasks.map(item =>
                  item.id === task.id ? { ...item, status: nextStatus } : item
                ),
              }
            : row
        )
      );

      setSuccess(
        nextStatus === 'completed' ? 'Task marked complete.' : 'Task reopened.'
      );
    } catch (problem) {
      setError(
        problem instanceof Error
          ? problem.message
          : 'Task progress could not be saved.'
      );
    } finally {
      setTaskSaving(false);
    }
  };

  const graphRows =
    stageWidth < 480
      ? 1 + (career?.skillRequirements.length || 0) + (roadmap?.tasks.length || 0)
      : Math.max(
          stageWidth >= 760
            ? Math.ceil((career?.skillRequirements.length || 0) / 2)
            : (career?.skillRequirements.length || 0),
          roadmap?.tasks.length || 0
        );

  const graphHeight = Math.max(540, (graphRows - 1) * 210 + 180);

  const selectedSkillEvidence = selected?.skillId
    ? evidence.filter(item => item.skill_id === selected.skillId)
    : [];

  const relatedTasks =
    selected?.type === 'skill'
      ? (roadmap?.tasks || []).filter(item => item.skill_id === selected.skillId)
      : [];

  return (
    <section className="universe-page">
      <header className="universe-heading">
        <div>
          <p className="eyebrow">CAREER INTELLIGENCE · INTERACTIVE MAP</p>
          {/* The duplicate page title was removed. */}
          <p>
            Follow catalog-backed relationships from a career goal to skills, tasks, and projects.
          </p>
        </div>

        <label className="universe-career-select">
          Career goal
          <select
            aria-label="Career goal"
            value={career?.id || ''}
            onChange={event => {
              setCareerId(event.target.value);
              setRoadmapId('');
              setSelectedId('');
              setPan({ x: 0, y: 0 });
            }}
          >
            <option value="" disabled>Select a career</option>
            {careers.map(item => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <p className="form-error" role="alert">
          {error} Roadmap or evidence links may be incomplete; available catalog relationships remain visible.
          {' '}
          <button
            className="text-link"
            onClick={() => {
              setError('');
              setEvidenceError('');
              setReloadVersion(value => value + 1);
            }}
          >
            Retry loading
          </button>
        </p>
      )}

      {success && <p className="notice" role="status">{success}</p>}

      <div className="universe-toolbar" aria-label="Explorer controls">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search graph"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search careers, skills, or tasks"
          />
        </label>

        <div className="universe-filters" role="group" aria-label="Filter graph nodes">
          {(['all', 'career', 'skill', 'task', 'project'] as const).map(value => (
            <button
              key={value}
              className={`filter ${filter === value ? 'active' : ''}`}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {value === 'all' ? 'All' : `${value[0].toUpperCase()}${value.slice(1)}s`}
            </button>
          ))}
        </div>

        {careerRoadmaps.length > 0 && (
          <label className="universe-roadmap-select toolbar-roadmap-select">
            Learning path
            <select
              aria-label="Learning path"
              value={roadmap?.id || ''}
              onChange={event => setRoadmapId(event.target.value)}
            >
              {careerRoadmaps.map(item => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        )}

        <button
          className={`button secondary mode-control ${interactionMode === 'pan' ? 'is-active' : ''}`}
          aria-pressed={interactionMode === 'pan'}
          onClick={() => setInteractionMode(mode => mode === 'pan' ? 'rotate' : 'pan')}
        >
          {interactionMode === 'pan' ? <Hand size={14} /> : <SlidersHorizontal size={14} />}
          {interactionMode === 'pan' ? 'Pan' : 'Rotate'}
        </button>

        <button
          className="button secondary universe-view-toggle"
          aria-pressed={listView}
          onClick={() => setListView(value => !value)}
        >
          {listView ? '3D view' : 'List view'}
        </button>

        {careerRoadmaps.length > 1 && (
          <button
            className="button secondary compare-paths"
            aria-expanded={comparePaths}
            onClick={() => setComparePaths(value => !value)}
          >
            <GitCompareArrows size={14} />
            {comparePaths ? 'Hide compare' : 'Compare paths'}
          </button>
        )}

        {!listView && (
          <button className="button secondary" disabled={!selected} onClick={focusSelected}>
            Focus
          </button>
        )}

        <button className="button secondary" onClick={resetView}>
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {comparePaths && (
        <section className="path-comparison" aria-label="Compare saved learning paths">
          {careerRoadmaps.map(item => {
            const skillIds = [...new Set(item.tasks.map(task => task.skill_id).filter(Boolean))];
            const timeNotes = item.tasks
              .map(task => task.estimated_time || task.effort_note)
              .filter(Boolean);

            return (
              <article
                key={item.id}
                className={`path-comparison-card ${item.id === roadmap?.id ? 'current' : ''}`}
              >
                <div>
                  <b>{item.title}</b>
                  <small>{item.strategy?.replace('_', ' ') || 'Saved path'} · {item.status}</small>
                </div>

                <span>{item.tasks.length} tasks</span>
                <span>{skillIds.length} catalog skills</span>
                <span>{item.tasks.filter(task => task.status === 'completed').length} completed</span>

                <p>{item.tasks.map(task => task.title).join(' → ') || 'No tasks recorded'}</p>

                <small>
                  Task effort notes: {timeNotes.length ? [...new Set(timeNotes)].join(' · ') : 'Not estimated'}
                </small>

                <button
                  className="text-link"
                  onClick={() => {
                    setRoadmapId(item.id);
                    setComparePaths(false);
                  }}
                >
                  Explore this path <ArrowRight size={13} />
                </button>
              </article>
            );
          })}
        </section>
      )}

      <div className="universe-layout">
        <section className="universe-stage-panel panel" aria-label="Career path graph">
          {loading && <p className="small-muted" role="status">Loading saved roadmaps…</p>}

          {listView ? (
            <div className="universe-list" role="list" aria-label="Career path nodes">
              {visibleNodes.map(node => (
                <div role="listitem" key={node.id}>
                  <button
                    className={`universe-list-row ${selected?.id === node.id ? 'selected' : ''}`}
                    onClick={() => selectNode(node)}
                  >
                    <span className={`universe-node-icon ${node.type}`} aria-hidden="true">
                      {node.type === 'career'
                        ? <BriefcaseBusiness size={17} />
                        : node.type === 'skill'
                          ? <SlidersHorizontal size={16} />
                          : <BookOpen size={16} />}
                    </span>

                    <span>
                      <b>{node.label}</b>
                      <small>
                        {node.type} · {node.type === 'career' ? 'Career goal' : statusLabel[node.status]}
                      </small>
                    </span>

                    <ArrowRight size={15} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              ref={stageRef}
              className={`universe-stage ${interactionMode === 'pan' ? 'pan-mode' : ''}`}
              style={{ height: `${graphHeight}px` }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
              onContextMenu={event => event.preventDefault()}
              onWheel={event => setZoom(value => Math.max(.72, Math.min(1.35, value - event.deltaY * .001)))}
              onKeyDown={event => {
                const step = event.shiftKey ? 12 : 5;

                if (event.key === 'ArrowLeft') {
                  setRotation(value => ({ ...value, y: value.y - step }));
                }
                if (event.key === 'ArrowRight') {
                  setRotation(value => ({ ...value, y: value.y + step }));
                }
                if (event.key === 'ArrowUp') {
                  setRotation(value => ({ ...value, x: Math.max(-32, value.x - step) }));
                }
                if (event.key === 'ArrowDown') {
                  setRotation(value => ({ ...value, x: Math.min(32, value.x + step) }));
                }
              }}
              tabIndex={0}
              role="application"
              aria-label={`${interactionMode === 'pan' ? 'Pan' : 'Rotate'} the career map with pointer drag. Use arrow keys to rotate, mouse wheel to zoom. Select a node to see details.`}
            >
              <div
                className="universe-grid"
                style={{ transform: `translateZ(-80px) rotateX(72deg) scale(${zoom})` }}
                aria-hidden="true"
              />

              <div
                className="universe-graph"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) scale(${zoom})`,
                }}
              >
                <svg
                  className="universe-edges"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {edges.map(([from, to], index) => {
                    const a = nodes.find(node => node.id === from);
                    const b = nodes.find(node => node.id === to);

                    if (
                      !a ||
                      !b ||
                      !visibleNodes.some(node => node.id === from) ||
                      !visibleNodes.some(node => node.id === to)
                    ) {
                      return null;
                    }

                    const onPath = a.type === 'task' || b.type === 'task';

                    return (
                      <line
                        key={`${from}-${to}-${index}`}
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        className={
                          selected?.id === from || selected?.id === to
                            ? 'active'
                            : onPath
                              ? 'path-edge'
                              : ''
                        }
                      />
                    );
                  })}
                </svg>

                {visibleNodes.map(node => (
                  <button
                    key={node.id}
                    title={node.label}
                    className={`universe-node ${node.type} ${node.status} ${selected?.id === node.id ? 'selected' : ''}`}
                    style={{
                      left: `${node.x}%`,
                      top: `${node.y}%`,
                      transform: `translate(-50%, -50%) translateZ(${node.z}px)`,
                    }}
                    onClick={event => {
                      event.stopPropagation();
                      selectNode(node);
                    }}
                    aria-pressed={selected?.id === node.id}
                    aria-label={`${node.type}: ${node.label}. ${node.type === 'career' ? 'Career goal' : statusLabel[node.status]}`}
                  >
                    <span className="universe-joint">
                      {node.type === 'career'
                        ? <BriefcaseBusiness size={23} />
                        : node.type === 'skill'
                          ? <SlidersHorizontal size={18} />
                          : node.type === 'project'
                            ? <CheckCircle2 size={18} />
                            : <BookOpen size={17} />}
                    </span>

                    <span className="universe-node-label">{node.label}</span>
                  </button>
                ))}
              </div>

              <div className="universe-column-labels" aria-hidden="true">
                <span>CAREER GOAL</span>
                <span>REQUIRED SKILLS</span>
                {roadmap && <span>LEARNING PLAN</span>}
              </div>

              <div className="universe-legend">
                <span><i className="completed" />Completed</span>
                <span><i className="in_progress" />In progress</span>
                <span><i className="blocked" />Blocked</span>
                <span><i className="evidenced" />Evidence</span>
                <span><i className="unknown" />Unassessed</span>
              </div>

              <small className="universe-hint">Drag to {interactionMode} · Wheel to zoom</small>
            </div>
          )}
        </section>

        <aside className="universe-details panel" aria-live="polite">
          {selected ? (
            <>
              <div className="details-panel-head">
                <div>
                  <p className="eyebrow">{selected.type.toUpperCase()} DETAILS</p>
                  <h2>{selected.label}</h2>
                </div>

                {selected.type !== 'career' && (
                  <button className="button secondary focus-detail" onClick={focusSelected}>
                    Focus in graph
                  </button>
                )}
              </div>

              <p>{selected.description}</p>

              {selected.type !== 'career' && (
                <div className={`universe-status ${selected.status}`}>
                  <Circle size={11} />
                  {statusLabel[selected.status]}
                </div>
              )}

              {selected.type === 'career' && (
                <>
                  <h3>Career match</h3>

                  {match?.score != null ? (
                    <div className="career-match-score">
                      <b>{match.score}%</b>
                      <span>
                        Relative alignment from available profile and catalog signals.
                        This is not an employment probability.
                      </span>
                    </div>
                  ) : (
                    <p className="small-muted">
                      Match unavailable until assessment or profile signals are recorded.
                    </p>
                  )}

                  {match?.reasons.length ? (
                    <ul className="match-reasons">
                      {match.reasons.slice(0, 3).map(reason => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}

                  <h3>Required skills</h3>

                  {career?.skillRequirements.length ? (
                    <ul>
                      {career.skillRequirements.map(item => {
                        const skillNode = nodes.find(node => node.skillId === item.id);

                        return (
                          <li key={item.id}>
                            <button onClick={() => skillNode && selectNode(skillNode)}>
                              {item.name}
                              <small>
                                {evidence.some(record => record.skill_id === item.id)
                                  ? 'Evidence recorded'
                                  : 'No evidence recorded'}
                              </small>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="small-muted">
                      No skill requirements are linked to this career in the catalog.
                    </p>
                  )}

                  {match?.notYetEvidenced.length ? (
                    <p className="gap-note">
                      {match.notYetEvidenced.length} required skill
                      {match.notYetEvidenced.length === 1 ? '' : 's'} have no linked evidence.
                      That does not establish proficiency.
                    </p>
                  ) : null}

                  <h3>Next step</h3>

                  <Link
                    className="button primary full"
                    to="/roadmap-generator"
                    onClick={() => career && onChooseCareer?.(career.id)}
                  >
                    Build a learning path <ArrowRight size={14} />
                  </Link>
                </>
              )}

              {selected.type === 'skill' && (
                <>
                  <h3>Evidence</h3>

                  {evidenceLoading ? (
                    <p role="status">Loading your evidence…</p>
                  ) : selectedSkillEvidence.length ? (
                    <ul className="evidence-record-list">
                      {selectedSkillEvidence.slice(0, 3).map(record => (
                        <li key={record.id}>
                          <span>{record.evidence_type.replaceAll('_', ' ')}</span>
                          <small>{new Date(record.created_at).toLocaleDateString()}</small>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="small-muted">
                      No evidence recorded. This is unknown proficiency, not evidence of a skill gap.
                    </p>
                  )}

                  <h3>Proficiency</h3>
                  <p className="small-muted">
                    Current and target proficiency are not available in the catalog.
                  </p>

                  {relatedTasks.length > 0 && (
                    <>
                      <h3>Related tasks and projects</h3>
                      <ul>
                        {relatedTasks.map(task => (
                          <li key={task.id}>
                            <button
                              onClick={() =>
                                selectNode(nodes.find(node => node.task?.id === task.id) || selected)
                              }
                            >
                              {task.title}
                              <small>{task.task_type.replace('_', ' ')}</small>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <h3>Next action</h3>
                  <Link className="inline-link" to="/skills">
                    Review skill evidence <ArrowRight size={14} />
                  </Link>
                </>
              )}

              {selected.task && (
                <>
                  <h3>Task status</h3>
                  <p className="small-muted">
                    {selected.task.status.replace('_', ' ')}
                    {selected.status === 'blocked' ? ' · prerequisite incomplete' : ''}
                  </p>

                  <h3>Completion criteria</h3>
                  <p>
                    {selected.task.completion_criteria ||
                      'No completion criteria were provided for this task.'}
                  </p>

                  <h3>Estimated effort</h3>
                  <p>
                    {selected.task.estimated_time ||
                      selected.task.effort_note ||
                      'Not estimated'}
                  </p>

                  <h3>Dependencies</h3>
                  <p className="small-muted">
                    {selected.task.depends_on.length
                      ? selected.task.depends_on
                          .map(key => roadmap?.tasks.find(item => item.client_key === key)?.title || key)
                          .join(' · ')
                      : 'No recorded prerequisites'}
                  </p>

                  <button
                    className={`button ${selected.task.status === 'completed' ? 'secondary' : 'primary'} full`}
                    disabled={taskSaving || selected.status === 'blocked'}
                    onClick={() => void toggleTask(selected.task!)}
                  >
                    {taskSaving
                      ? 'Saving progress…'
                      : selected.task.status === 'completed'
                        ? 'Reopen task'
                        : selected.status === 'blocked'
                          ? 'Complete prerequisite first'
                          : 'Mark task complete'}

                    {selected.task.status !== 'completed' &&
                      selected.status !== 'blocked' && <Check size={14} />}
                  </button>
                </>
              )}
            </>
          ) : (
            <p>Select a node to inspect it.</p>
          )}
        </aside>
      </div>
    </section>
  );
}