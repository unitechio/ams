import { driver, type Alignment, type DriveStep, type Side } from 'driver.js';

type WorkflowTourId = 'create-user' | 'create-auth-client' | 'review-audit-log';

type WorkflowStep = {
  route: string;
  element: string;
  title: string;
  description: string;
  side?: Side;
  align?: Alignment;
};

type WorkflowTour = {
  id: WorkflowTourId;
  label: string;
  description: string;
  steps: WorkflowStep[];
};

type WorkflowTourState = {
  id: WorkflowTourId;
  stepIndex: number;
};

const STORAGE_KEY = 'ams.workflow-tour';
const EVENT_NAME = 'ams:workflow-tour';
const ELEMENT_RETRY_MS = 180;
const ELEMENT_RETRY_LIMIT = 12;

const WORKFLOW_TOURS: WorkflowTour[] = [
  {
    id: 'create-user',
    label: 'Tour tạo user',
    description: 'Đi qua list người dùng, mở form tạo mới, gán role, client và channel theo data thật.',
    steps: [
      {
        route: '/users',
        element: '[data-tour="users-create-button"]',
        title: 'Bắt đầu từ danh sách user',
        description: 'Admin thường khởi tạo user mới từ trang danh sách này để tra cứu trước rồi mới tạo.',
        side: 'bottom',
        align: 'end',
      },
      {
        route: '/users/create',
        element: '[data-tour="create-user-basic"]',
        title: 'Thông tin cơ bản',
        description: 'Nhập username, password, email và các thông tin định danh ban đầu của user.',
      },
      {
        route: '/users/create',
        element: '[data-tour="create-user-roles"]',
        title: 'Gán vai trò',
        description: 'Vai trò quyết định quyền nền tảng. Chỉ gán đủ theo nguyên tắc least privilege.',
      },
      {
        route: '/users/create',
        element: '[data-tour="create-user-clients"]',
        title: 'Allowed clients',
        description: 'Giới hạn user được phép đăng nhập qua những OAuth client nào.',
      },
      {
        route: '/users/create',
        element: '[data-tour="create-user-channels"]',
        title: 'Allowed channels',
        description: 'Giới hạn bề mặt đăng nhập như web, mobile, CRM hay kiosk theo nhu cầu vận hành.',
      },
      {
        route: '/users/create',
        element: '[data-tour="create-user-save"]',
        title: 'Hoàn tất khởi tạo',
        description: 'Lưu user sau khi đã kiểm tra one-time password, role và boundary đăng nhập.',
        side: 'top',
        align: 'center',
      },
    ],
  },
  {
    id: 'create-auth-client',
    label: 'Tour tạo auth client',
    description: 'Đi qua danh sách client, mở editor và cấu hình boundary, audience, channel, grant.',
    steps: [
      {
        route: '/auth-clients',
        element: '[data-tour="auth-clients-create-button"]',
        title: 'Bắt đầu từ danh sách OAuth client',
        description: 'Client mới nên được khởi tạo từ registry quản lý tập trung để giữ naming và governance đồng bộ.',
        side: 'bottom',
        align: 'end',
      },
      {
        route: '/auth-clients/create',
        element: '[data-tour="auth-client-identity"]',
        title: 'Định danh client',
        description: 'Khai báo template, environment, client_id và owner team để gắn đúng security boundary.',
      },
      {
        route: '/auth-clients/create',
        element: '[data-tour="auth-client-token"]',
        title: 'Token & security',
        description: 'Cấu hình grant type, audience, redirect URI, trusted type và client secret policy.',
      },
      {
        route: '/auth-clients/create',
        element: '[data-tour="auth-client-channels"]',
        title: 'Channel mapping',
        description: 'Client và login channel là hai khái niệm khác nhau. Chỗ này chỉ map những channel được phép dùng client.',
      },
      {
        route: '/auth-clients/create',
        element: '[data-tour="auth-client-boundary"]',
        title: 'Security boundary',
        description: 'Chọn public/confidential, PKCE, legacy password grant và active state theo đúng use case.',
      },
      {
        route: '/auth-clients/create',
        element: '[data-tour="auth-client-save"]',
        title: 'Lưu OAuth client',
        description: 'Lưu cấu hình sau khi kiểm tra audience, redirect URI và channel mapping đã đủ chặt.',
        side: 'top',
        align: 'center',
      },
    ],
  },
  {
    id: 'review-audit-log',
    label: 'Tour review audit log',
    description: 'Đi qua bộ lọc, mốc thời gian và bảng log để review sự kiện bảo mật hoặc thay đổi cấu hình.',
    steps: [
      {
        route: '/logs/audit',
        element: '[data-tour="audit-search"]',
        title: 'Tìm nhanh sự kiện',
        description: 'Dùng search để tìm theo action, resource, ID hoặc nội dung liên quan trước khi lọc sâu hơn.',
      },
      {
        route: '/logs/audit',
        element: '[data-tour="audit-filters-toggle"]',
        title: 'Bật bộ lọc nâng cao',
        description: 'Mở panel filter khi cần khoanh vùng theo user, action và mốc thời gian chi tiết tới giờ phút giây.',
      },
      {
        route: '/logs/audit',
        element: '[data-tour="audit-filters-panel"]',
        title: 'Khoanh vùng điều tra',
        description: 'Dùng user, action, from và to để dựng lại chính xác khoảng thời gian sự kiện xảy ra.',
      },
      {
        route: '/logs/audit',
        element: '[data-tour="audit-table"]',
        title: 'Đọc kết quả',
        description: 'Bảng log là nơi review allowed/denied, resource và mốc thời gian trước khi mở chi tiết từng bản ghi.',
      },
    ],
  },
];

let activeDriver: ReturnType<typeof driver> | null = null;
let pendingRetry: number | null = null;
let activeRunKey = '';

function getWorkflowState(): WorkflowTourState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkflowTourState;
  } catch {
    return null;
  }
}

function setWorkflowState(state: WorkflowTourState | null) {
  if (typeof window === 'undefined') return;
  if (!state) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function emitWorkflowEvent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
}

function getWorkflowById(id: WorkflowTourId) {
  return WORKFLOW_TOURS.find((item) => item.id === id);
}

function getCurrentStep() {
  const state = getWorkflowState();
  if (!state) return null;
  const workflow = getWorkflowById(state.id);
  const step = workflow?.steps[state.stepIndex];
  if (!workflow || !step) return null;
  return { state, workflow, step };
}

function clearRetry() {
  if (pendingRetry !== null) {
    window.clearTimeout(pendingRetry);
    pendingRetry = null;
  }
}

function closeActiveDriver() {
  clearRetry();
  activeRunKey = '';
  if (activeDriver) {
    activeDriver.destroy();
    activeDriver = null;
  }
}

function finishWorkflowTour() {
  setWorkflowState(null);
  closeActiveDriver();
}

function advanceWorkflowTour(navigate: (path: string) => void) {
  const current = getCurrentStep();
  if (!current) {
    finishWorkflowTour();
    return;
  }
  const nextIndex = current.state.stepIndex + 1;
  if (nextIndex >= current.workflow.steps.length) {
    finishWorkflowTour();
    return;
  }
  setWorkflowState({ id: current.state.id, stepIndex: nextIndex });
  const nextStep = current.workflow.steps[nextIndex];
  closeActiveDriver();
  if (window.location.pathname !== nextStep.route) {
    navigate(nextStep.route);
    return;
  }
  window.setTimeout(() => emitWorkflowEvent(), 60);
}

function renderWorkflowStep(step: WorkflowStep, navigate: (path: string) => void) {
  const target = document.querySelector(step.element);
  if (!target) return false;

  closeActiveDriver();
  activeRunKey = `${window.location.pathname}:${step.element}:${step.title}`;
  activeDriver = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    smoothScroll: true,
    showButtons: ['close', 'next'],
    nextBtnText: 'Tiếp theo',
    steps: [
      {
        element: step.element,
        popover: {
          title: step.title,
          description: step.description,
          side: step.side,
          align: step.align,
          showButtons: ['close', 'next'],
          nextBtnText: 'Tiếp theo',
          onNextClick: () => advanceWorkflowTour(navigate),
          onCloseClick: () => finishWorkflowTour(),
        },
      } satisfies DriveStep,
    ],
    onDestroyed: () => {
      activeDriver = null;
      activeRunKey = '';
    },
  });
  activeDriver.drive();
  return true;
}

export function startWorkflowTour(id: WorkflowTourId, navigate: (path: string) => void) {
  const workflow = getWorkflowById(id);
  if (!workflow) return;
  setWorkflowState({ id, stepIndex: 0 });
  closeActiveDriver();
  const first = workflow.steps[0];
  if (window.location.pathname !== first.route) {
    navigate(first.route);
    return;
  }
  emitWorkflowEvent();
}

export function resumeWorkflowTour(pathname: string, navigate: (path: string) => void, retryCount = 0) {
  const current = getCurrentStep();
  if (!current) {
    finishWorkflowTour();
    return;
  }
  if (pathname !== current.step.route) return;

  const runKey = `${pathname}:${current.step.element}:${current.state.id}:${current.state.stepIndex}`;
  if (activeRunKey === runKey && activeDriver?.isActive()) return;

  const rendered = renderWorkflowStep(current.step, navigate);
  if (rendered) {
    activeRunKey = runKey;
    return;
  }

  if (retryCount >= ELEMENT_RETRY_LIMIT) {
    finishWorkflowTour();
    return;
  }

  clearRetry();
  pendingRetry = window.setTimeout(() => {
    resumeWorkflowTour(pathname, navigate, retryCount + 1);
  }, ELEMENT_RETRY_MS);
}

export function subscribeWorkflowTours(onChange: () => void) {
  const handler = () => onChange();
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

export const workflowTours = WORKFLOW_TOURS.map(({ id, label, description }) => ({
  id,
  label,
  description,
}));
