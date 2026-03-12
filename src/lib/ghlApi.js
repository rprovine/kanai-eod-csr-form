// Client-side GHL API wrapper
// Calls Vercel serverless functions for GHL data

const BASE = '/api/ghl';

export async function fetchPrefill(employeeId, date, { shiftStart, shiftEnd } = {}) {
  if (!employeeId || !date) return null;

  try {
    const params = new URLSearchParams({ employee_id: employeeId, date });
    if (shiftStart) params.set('shift_start', shiftStart);
    if (shiftEnd) params.set('shift_end', shiftEnd);
    const response = await fetch(`${BASE}/prefill?${params}`);

    if (!response.ok) {
      console.error('GHL prefill error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('GHL prefill fetch error:', error);
    return null;
  }
}

export async function fetchPipelineStatus(employeeId, date) {
  if (!employeeId) return null;

  try {
    const params = new URLSearchParams({ employee_id: employeeId });
    if (date) params.set('date', date);
    const response = await fetch(`${BASE}/pipeline?${params}`);

    if (!response.ok) {
      console.error('GHL pipeline error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('GHL pipeline fetch error:', error);
    return null;
  }
}

export async function checkGhlStatus() {
  try {
    const response = await fetch(`${BASE}/test`);
    return await response.json();
  } catch (error) {
    console.error('GHL status check error:', error);
    return { status: 'error', error: error.message };
  }
}

export async function fetchWorkizJobs(date) {
  if (!date) return null;

  try {
    const params = new URLSearchParams({ date });
    const response = await fetch(`/api/workiz/jobs?${params}`);

    if (!response.ok) {
      console.error('Workiz jobs error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Workiz jobs fetch error:', error);
    return null;
  }
}

export async function fetchGhlAttributions(phones) {
  if (!phones || phones.length === 0) return null;

  try {
    const response = await fetch(`${BASE}/attribution`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phones }),
    });

    if (!response.ok) {
      console.error('GHL attribution error:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('GHL attribution fetch error:', error);
    return null;
  }
}
