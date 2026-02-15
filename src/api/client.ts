import type {
  ApiResult,
  AppConfig,
  AssignmentInputRow,
  AssessmentIndividualRow,
  AssessmentZipRow,
  InterviewInputRow,
  JobStatusResponse,
  StartJobResponse,
  VideoUploaderMetadata,
} from "../types";

const API_BASE = process.env.REACT_APP_API_URL ?? "http://localhost:4000/api";

const assertResponse = async (response: Response): Promise<Response> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  return response;
};

const postJson = async <T>(path: string, payload: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  await assertResponse(response);
  return response.json() as Promise<T>;
};

export const fetchAppConfig = async (): Promise<AppConfig> => {
  const response = await fetch(`${API_BASE}/app-config`);
  await assertResponse(response);
  return response.json() as Promise<AppConfig>;
};

export const fetchJobStatus = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`);
  await assertResponse(response);
  return response.json() as Promise<JobStatusResponse>;
};

export const cancelJob = async (jobId: string): Promise<JobStatusResponse> => {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, {
    method: "POST",
  });
  await assertResponse(response);
  return response.json() as Promise<JobStatusResponse>;
};

export const analyzeInterviewRows = (rows: InterviewInputRow[], product: string): Promise<ApiResult> => {
  return postJson<ApiResult>("/interview/analyzer", { rows, product });
};

export const startInterviewAnalyzerJob = (
  rows: InterviewInputRow[],
  product: string,
): Promise<StartJobResponse> => {
  return postJson<StartJobResponse>("/interview/analyzer/start", { rows, product });
};

export const analyzeVideoUploader = async (args: {
  metadata: VideoUploaderMetadata;
  file: File;
  product: string;
}): Promise<ApiResult> => {
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(args.metadata));
  formData.append("product", args.product);
  formData.append("video", args.file);

  const response = await fetch(`${API_BASE}/interview/video-uploader`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<ApiResult>;
};

export const startVideoUploaderJob = async (args: {
  metadata: VideoUploaderMetadata;
  file: File;
  product: string;
}): Promise<StartJobResponse> => {
  const formData = new FormData();
  formData.append("metadata", JSON.stringify(args.metadata));
  formData.append("product", args.product);
  formData.append("video", args.file);

  const response = await fetch(`${API_BASE}/interview/video-uploader/start`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<StartJobResponse>;
};

export const analyzeDrilldownRows = (rows: Array<Record<string, string>>, product: string): Promise<ApiResult> => {
  return postJson<ApiResult>("/drilldown/analyze", { rows, product });
};

export const startDrilldownJob = (
  rows: Array<Record<string, string>>,
  product: string,
): Promise<StartJobResponse> => {
  return postJson<StartJobResponse>("/drilldown/analyze/start", { rows, product });
};

export const analyzeAssignmentsRows = (
  rows: AssignmentInputRow[],
  product: string,
): Promise<ApiResult> => {
  return postJson<ApiResult>("/assignments/analyze", { rows, product });
};

export const startAssignmentsJob = (
  rows: AssignmentInputRow[],
  product: string,
): Promise<StartJobResponse> => {
  return postJson<StartJobResponse>("/assignments/analyze/start", { rows, product });
};

export const analyzeAssessmentsZip = async (
  rows: AssessmentZipRow[],
  product: string,
): Promise<ApiResult> => {
  const formData = new FormData();
  formData.append("product", product);

  const normalizedRows = rows
    .filter((row) => row.file)
    .map((row) => ({
      fileField: row.fileField,
      company_name: row.company_name,
      job_id: row.job_id,
      assessment_date: row.assessment_date,
    }));

  formData.append("rows", JSON.stringify(normalizedRows));

  for (const row of rows) {
    if (row.file) {
      formData.append(row.fileField, row.file);
    }
  }

  const response = await fetch(`${API_BASE}/assessments/zip`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<ApiResult>;
};

export const startAssessmentsZipJob = async (
  rows: AssessmentZipRow[],
  product: string,
): Promise<StartJobResponse> => {
  const formData = new FormData();
  formData.append("product", product);

  const normalizedRows = rows
    .filter((row) => row.file)
    .map((row) => ({
      fileField: row.fileField,
      company_name: row.company_name,
      job_id: row.job_id,
      assessment_date: row.assessment_date,
    }));

  formData.append("rows", JSON.stringify(normalizedRows));

  for (const row of rows) {
    if (row.file) {
      formData.append(row.fileField, row.file);
    }
  }

  const response = await fetch(`${API_BASE}/assessments/zip/start`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<StartJobResponse>;
};

export const analyzeAssessmentsIndividual = async (
  rows: AssessmentIndividualRow[],
  product: string,
): Promise<ApiResult> => {
  const formData = new FormData();
  formData.append("product", product);

  const normalizedRows = rows
    .filter((row) => row.file)
    .map((row) => ({
      fileField: row.fileField,
      company_name: row.company_name,
      job_id: row.job_id,
      assessment_date: row.assessment_date,
    }));

  formData.append("rows", JSON.stringify(normalizedRows));

  for (const row of rows) {
    if (row.file) {
      formData.append(row.fileField, row.file);
    }
  }

  const response = await fetch(`${API_BASE}/assessments/individual`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<ApiResult>;
};

export const startAssessmentsIndividualJob = async (
  rows: AssessmentIndividualRow[],
  product: string,
): Promise<StartJobResponse> => {
  const formData = new FormData();
  formData.append("product", product);

  const normalizedRows = rows
    .filter((row) => row.file)
    .map((row) => ({
      fileField: row.fileField,
      company_name: row.company_name,
      job_id: row.job_id,
      assessment_date: row.assessment_date,
    }));

  formData.append("rows", JSON.stringify(normalizedRows));

  for (const row of rows) {
    if (row.file) {
      formData.append(row.fileField, row.file);
    }
  }

  const response = await fetch(`${API_BASE}/assessments/individual/start`, {
    method: "POST",
    body: formData,
  });

  await assertResponse(response);
  return response.json() as Promise<StartJobResponse>;
};

export const getDrilldownSampleTemplateUrl = (): string => {
  return `${API_BASE}/drilldown/sample-template`;
};
