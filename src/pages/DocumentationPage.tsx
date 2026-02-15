import { useEffect, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./DocumentationPage.css";

const documentationMarkdown = `
# PsmTool

# 1) PRODUCT SELECTOR (Global)

**Input Type:** Dropdown

**Field:**

- \`product\` -> Select from:
  - Intensive
  - Academy
  - External
  - Academy Edge
  - Nxtwave Edge
  - NIAT
  - Intensive Offline
  - Experienced Hiring

---

# 2) INTERVIEW ANALYSER

## A) Drive-Based Interview Analyzer

### Input Method 1: Paste Text (Tab Separated)

**Accepted Columns (7 / 8 / 9 columns supported)**

**9 Columns Format (Recommended)**

~~~
user_id	fullName	MobileNumber	interview_round	drive_file_id	job_id	company_name	clip_start_time	clip_end_time
~~~

**Example**

~~~
U123	John Doe	9876543210	1	1gfZvlSqDriveID	JOB01	Google	0	300
~~~

---

### Input Method 2: Upload CSV

**Mandatory Column**

- drive_file_id

**Optional Columns**

- user_id
- fullName
- MobileNumber
- interview_round
- job_id
- company_name
- clip_start_time
- clip_end_time

---

## B) Video Uploader (Local File)

### Step 1: Paste Metadata (Tab Separated)

~~~
user_id	fullName	MobileNumber	interview_round	drive_file_id	job_id	company_name	clip_start_time	clip_end_time
~~~

Example:

~~~
U123	John Doe	9876543210	1	Local	JOB01	Google	0	600
~~~

### Step 2: Upload Video File

Supported formats:

- mp4
- mov
- avi
- mkv
- webm

---

# 3) DRILLDOWN

## Input: Upload CSV

### Mandatory Columns

~~~
Interview Date
User ID
User Name
Mobile Number
Job ID
Company Name
~~~

### Round Columns (Any of These)

~~~
Screening Questions
Assessment questions
Technical round Questions
Technical2 round Questions
H.R Questions
Cultural fit Round Questions
Managerial Round questions
CEO/Founder/Director Round Questions
~~~

---

# 4) ASSESSMENTS

## A) ZIP File Processor

For each company row:

### Input Fields

- \`company_name\` -> Text
- \`job_id\` -> Text
- \`assessment_date\` -> Date
- \`uploaded_zip_file\` -> \`.zip\`

### Supported file formats inside ZIP

- PDF
- PNG
- JPG
- JPEG
- WEBP
- TIFF
- BMP

---

## B) Individual File Processor

For each row:

### Input Fields

- \`job_id\` -> Text
- \`company_name\` -> Text
- \`assessment_date\` -> Date
- \`uploaded_file\` -> PDF / PNG / JPG / JPEG / WEBP / TIFF / BMP

---

# 5) ASSIGNMENTS

## A) Paste Text (Tab Separated)

~~~
job_id	company_name	assignment_link	assignment_date
~~~

Example:

~~~
JOB123	Google	https://docs.google.com/...	2023-10-27
~~~

---

## B) Upload CSV

### Required Columns

~~~
job_id
company_name
assignment_link
assignment_date
~~~

---

If you want, we can also add:

- Only output formats
- Only sheet column formats
- Quick validation rules for each input
`;

const flattenText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((item) => flattenText(item)).join(" ");
  }

  if (node && typeof node === "object" && "props" in node) {
    const maybeProps = (node as { props?: { children?: ReactNode } }).props;
    return flattenText(maybeProps?.children ?? "");
  }

  return "";
};

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export function DocumentationPage() {
  useEffect(() => {
    document.body.classList.add("docs-body");

    return () => {
      document.body.classList.remove("docs-body");
    };
  }, []);

  return (
    <div className="docs-shell">
      <main className="docs-main">
        <article className="docs-card">
          <header className="docs-topbar">
            <h1>PsmTool Documentation</h1>
            <a href="/" className="docs-home-link">
              Open App
            </a>
          </header>

          <div className="docs-index" role="navigation" aria-label="Section quick links">
            <a href="#1-product-selector-global">1) Product Selector</a>
            <a href="#2-interview-analyser">2) Interview Analyser</a>
            <a href="#3-drilldown">3) Drilldown</a>
            <a href="#4-assessments">4) Assessments</a>
            <a href="#5-assignments">5) Assignments</a>
          </div>

          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => {
                const id = slugify(flattenText(children));
                return <h1 id={id}>{children}</h1>;
              },
              h2: ({ children }) => {
                const id = slugify(flattenText(children));
                return <h2 id={id}>{children}</h2>;
              },
              h3: ({ children }) => {
                const id = slugify(flattenText(children));
                return <h3 id={id}>{children}</h3>;
              },
            }}
          >
            {documentationMarkdown}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  );
}
