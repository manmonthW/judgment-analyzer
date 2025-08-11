"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileUp, Search, Brain, Scale, Download, ChevronRight, Share2, RefreshCw,
  FileText, Settings, Link2, Sparkles, ListTree, Workflow, ShieldAlert, CalendarClock, BookOpen, FileText as FileIcon
} from "lucide-react";

/** 工具函数 **/
function sanitizeToJson(text: string) {
  const trimmed = text?.trim?.().replace?.(/^```[a-zA-Z]*\n?|```$/g, "") ?? "";
  try { return JSON.parse(trimmed); } catch { return { _raw: trimmed || "" }; }
}
function download(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** 示例数据（未分析前用于占位） **/
const MOCK_CASE_TEXT = `
【案号】(2024)沪0115民初12345号
【法院】上海市浦东新区人民法院
【案由】服务合同纠纷
【当事人】原告：甲公司；被告：乙公司
【诉请】原告主张被告拖欠服务费100万元及逾期利息
【事实与理由】略
【判决结果】一、被告支付服务费90万元；二、驳回其他诉讼请求。
【法律依据】《民法典》第五百零九条、第五百八十条等。
`;

const MOCK_SUMMARY = {
  caseMeta: {
    caseNo: "(2024)沪0115民初12345号",
    court: "上海市浦东新区人民法院",
    date: "2024-12-18",
    cause: "服务合同纠纷"
  },
  parties: [
    { role: "原告", name: "甲公司" },
    { role: "被告", name: "乙公司" }
  ],
  focusPoints: [
    {
      title: "是否存在有效服务合同及履行事实",
      plaintiff: "提交合同与项目验收单，主张服务完成。",
      defendant: "质疑验收效力，称存在重大瑕疵。",
      court: "合同真实有效，验收单可采信。"
    },
    {
      title: "欠付服务费数额与利息计算",
      plaintiff: "请求支付100万元并按LPR计息。",
      defendant: "认可应付80万元。",
      court: "综合证据认定应付90万元，利息按合同约定起算。"
    }
  ],
  statutes: [
    {
      law: "《中华人民共和国民法典》",
      article: "第五百零九条",
      explain: "合同依法成立即具有法律约束力，依法履行。"
    },
    {
      law: "《中华人民共和国民法典》",
      article: "第五百八十条",
      explain: "价款支付与逾期利息承担的规则。"
    }
  ],
  decision: "被告支付90万元及相应利息；其余诉请驳回。",
  risk: {
    level: "中",
    notes: [
      "完善合同验收与证据留存流程。",
      "明确结算条款与违约金/利息基准。"
    ]
  }
};
// 原文视图
function RawView({ text }: { text: string }) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">原文</CardTitle>
        <CardDescription>自动清洗与结构化分段</CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea className="min-h-[420px] text-sm" defaultValue={text} />
      </CardContent>
    </Card>
  );
}
function SectionTitle({ icon: Icon, title, right }: { icon: any; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <Icon className="size-4" />
        <h4 className="font-medium">{title}</h4>
      </div>
      <div>{right}</div>
    </div>
  );
}


/** 左侧案件列表 **/
function Sidebar({ items, onSelect, activeId }: any) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader><CardTitle className="text-lg">案件列表</CardTitle></CardHeader>
      <CardContent className="space-y-2 overflow-auto" style={{ maxHeight: 520 }}>
        {items.map((it: any) => (
          <button key={it.id} onClick={() => onSelect(it.id)}
            className={`w-full text-left p-3 rounded-2xl border transition hover:shadow-sm ${activeId === it.id ? "bg-muted" : "bg-background"}`}>
            <div className="flex items-center justify-between"><div className="font-medium truncate">{it.title}</div><Badge variant="secondary">{it.status || "待分析"}</Badge></div>
            <div className="mt-1 text-xs text-muted-foreground truncate">{it.meta?.caseNo || it.meta?.court || "——"}</div>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/** 上传/抓取 + 开始分析 **/
function Uploader({ onUploaded, onAnalyze, analyzing }: { onUploaded: (item: any) => void; onAnalyze: (rawText: string) => void; analyzing: boolean; }) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [localText, setLocalText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function readFileToText(file: File) {
    if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) return await file.text();
    throw new Error("当前仅支持 .txt 或 text/* 文件");
  }
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = fileRef.current;
    const f = e.target.files?.[0];
    if (!f) { if (input) input.value = ""; return; }
    setUploading(true);
    try {
      const text = await readFileToText(f);
      setLocalText(text);
      setSelectedFileName(f.name);
      const id = Math.random().toString(36).slice(2, 9);
      onUploaded({ id, title: f.name, status: "待分析", meta: {}, raw: text, summary: MOCK_SUMMARY });
    } catch (err: any) {
      alert(err.message || "读取文件失败");
    } finally {
      setUploading(false);
      if (input) input.value = "";
    }
  }
  async function handleFetchUrl() {
    if (!url) return;
    setUploading(true);
    try {
      const r = await fetch(url);
      const html = await r.text();
      const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      setLocalText(text);
      setSelectedFileName(`抓取自: ${url}`);
      const id = Math.random().toString(36).slice(2, 9);
      onUploaded({ id, title: url, status: "待分析", meta: {}, raw: text, summary: MOCK_SUMMARY });
      setUrl("");
    } catch {
      alert("抓取失败，确认链接可访问");
    } finally { setUploading(false); }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-lg">上传/抓取判决书</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2 md:grid-cols-3">
          <input ref={fileRef} type="file" accept=".txt,text/plain" onChange={handleFile} className="hidden" />
          <div className="md:col-span-2">
            <Input 
              placeholder={selectedFileName || "选择文件或拖拽到此处..."} 
              readOnly 
              onClick={() => !uploading && fileRef.current?.click()} 
              value={selectedFileName}
              disabled={uploading}
            />
          </div>
          <Button className="gap-2 w-full" onClick={() => fileRef.current?.click()} disabled={uploading}><FileUp className="size-4" />本地上传</Button>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            placeholder="或粘贴公开网页链接…" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            disabled={uploading}
          />
          <Button variant="secondary" onClick={handleFetchUrl} className="gap-1" disabled={!url || uploading}>
            <Link2 className="size-4" />抓取
          </Button>
        </div>
        {uploading && <div className="space-y-2"><div className="text-sm text-muted-foreground">正在处理文本…</div><Progress value={66} /></div>}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        <Button variant="outline" className="gap-1" onClick={() => { 
          setLocalText(""); 
          setSelectedFileName("");
          setUrl("");
          if (fileRef.current) fileRef.current.value = ""; 
          alert("已重置上传缓存"); 
        }}><RefreshCw className="size-4" />重置</Button>
        <Button className="gap-1" onClick={() => onAnalyze(localText)} disabled={!localText || analyzing}>
          <Brain className="size-4" />{analyzing ? "分析中..." : "开始分析"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** 摘要视图 **/
function SummaryView({ data, json, onExportMD, onExportJSON }:{ data: typeof MOCK_SUMMARY; json?: any; onExportMD: () => void; onExportJSON: () => void; }) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader><CardTitle className="text-lg">AI 摘要</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-sm"><Pill>案号：{data.caseMeta.caseNo}</Pill><Pill>法院：{data.caseMeta.court}</Pill><Pill>日期：{data.caseMeta.date}</Pill><Pill>案由：{data.caseMeta.cause}</Pill></div>
        {/* Parties */}
        <SectionTitle icon={ListTree} title="当事人" />
        <div className="flex flex-wrap gap-2">{data.parties.map((p, i) => <Badge key={i} variant="secondary">{p.role} · {p.name}</Badge>)}</div>
        {/* Issues */}
        <SectionTitle icon={Workflow} title="争议焦点" />
        <div className="space-y-3">{data.focusPoints.map((f, i) => (<div key={i} className="rounded-2xl border p-3"><div className="font-medium mb-1">{i + 1}. {f.title}</div><div className="grid md:grid-cols-3 gap-2 text-sm text-muted-foreground"><div><span className="font-medium text-foreground">原告：</span>{f.plaintiff}</div><div><span className="font-medium text-foreground">被告：</span>{f.defendant}</div><div><span className="font-medium text-foreground">法院意见：</span>{f.court}</div></div></div>))}</div>
        {/* Statutes */}
        <SectionTitle icon={BookOpen} title="法律条款与通俗解读" />
        <div className="space-y-2 text-sm">{data.statutes.map((s, i) => (<div key={i} className="rounded-2xl border p-3 flex items-start gap-3"><Scale className="size-4 mt-1" /><div><div className="font-medium">{s.law} · {s.article}</div><div className="text-muted-foreground">{s.explain}</div></div></div>))}</div>
        {/* Decision */}
        <SectionTitle icon={ChevronRight} title="裁判结果" />
        <Card className="border-dashed"><CardContent className="p-4 text-sm">{data.decision}</CardContent></Card>
        {/* Risk */}
        <SectionTitle icon={ShieldAlert} title="风险与建议" />
        <div className="flex items-center gap-3"><Badge variant="destructive">风险：{data.risk.level}</Badge><ul className="list-disc text-sm text-muted-foreground pl-5">{data.risk.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>
        {/* JSON preview */}
        {json && (<div className="space-y-2"><SectionTitle icon={FileIcon} title="结构化结果(JSON 预览)" /><Card className="bg-muted/40"><CardContent className="p-3"><pre className="text-xs overflow-auto max-h-64">{JSON.stringify(json, null, 2)}</pre></CardContent></Card></div>)}
      </CardContent>
      <CardFooter className="gap-2"><Button className="gap-1" onClick={onExportMD}><Download className="size-4" />导出报告(MD)</Button><Button variant="outline" className="gap-1" onClick={onExportJSON}><Share2 className="size-4" />导出JSON</Button></CardFooter>
    </Card>
  );
}

/** 可视化视图 **/
function VisualView({ data }: { data: typeof MOCK_SUMMARY; }) {
  return (
    <Card className="h-full rounded-2xl">
      <CardHeader><CardTitle className="text-lg">可视化</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Timeline */}
        <SectionTitle icon={CalendarClock} title="案件时间线" />
        <div className="grid grid-cols-6 gap-2 text-xs">{["立案","开庭","举证","质证","合议","判决"].map((s, i) => (<div key={i} className="p-3 rounded-2xl border text-center"><div className="font-medium">{s}</div><div className="text-muted-foreground">2024-0{i+1}-15</div></div>))}</div>
        {/* Relationship diagram */}
        <SectionTitle icon={ListTree} title="当事人关系图（简化）" />
        <div className="rounded-2xl border p-6 grid place-items-center">
          <div className="relative w-full max-w-md h-56">
            <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} className="absolute left-1/2 -translate-x-1/2 top-2 bg-primary/10 border border-primary/30 rounded-xl px-3 py-1 text-xs">法院</motion.div>
            <motion.div initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }} className="absolute left-6 top-24 bg-emerald-50 border rounded-xl px-3 py-2 text-sm">原告·甲公司</motion.div>
            <motion.div initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} className="absolute right-6 top-24 bg-rose-50 border rounded-xl px-3 py-2 text-sm">被告·乙公司</motion.div>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute left-[26%] top-28 right-[26%] h-0.5 bg-gradient-to-r from-emerald-400 via-slate-300 to-rose-400" />
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="absolute left-1/2 -translate-x-1/2 top-32 text-xs text-muted-foreground">服务合同 / 价款争议</motion.div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 模式选择器 **/
function AnalysisModeSelector({ onChange, value }: { onChange: (mode: string) => void; value: string; }) {
  const modes = [
    { id: "lawyer", label: "律师 / 法律顾问", desc: "快速提取案情要点、证据链、适用法律条款" },
    { id: "corporate", label: "企业法务", desc: "批量分析涉及企业的案件风险" },
    { id: "media", label: "新闻媒体 / 研究人员", desc: "快速筛选大量判决的重点案例" },
    { id: "public", label: "普通公众", desc: "通俗语言理解案件结果和法律依据" }
  ];
  return (
    <div className="space-y-3">
      <h4 className="font-medium">分析模式</h4>
      {modes.map(m => (
        <label key={m.id} className={`flex items-start gap-2 p-2 border rounded-2xl hover:bg-muted cursor-pointer ${value === m.id ? 'bg-muted border-primary' : ''}`}>
          <input type="radio" name="analysisMode" value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} />
          <div><div className="font-medium">{m.label}</div><div className="text-xs text-muted-foreground">{m.desc}</div></div>
        </label>
      ))}
    </div>
  );
}

/** 右侧设置栏 **/
function RightPanelControls({ onReanalyze, analyzing }: { onReanalyze: () => void; analyzing: boolean; }) {
  const [mode, setMode] = useState("lawyer");
  const [normalize, setNormalize] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [exportFormats, setExportFormats] = useState({ pdf: true, docx: false, xlsx: false });
  
  useEffect(() => { (window as any).__analysisMode = mode; }, [mode]);

  const handleSaveConfig = () => {
    const config = {
      mode,
      normalize,
      highlight,
      exportFormats,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('judgment-analyzer-config', JSON.stringify(config));
    alert('配置已保存到本地存储');
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader><CardTitle className="text-lg">分析设置</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        <AnalysisModeSelector onChange={(m) => setMode(m)} value={mode} />
        <div className="flex items-center justify-between">
          <Label htmlFor="normalize">术语通俗化</Label>
          <Switch id="normalize" checked={normalize} onCheckedChange={setNormalize} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="highlight">原文关键字高亮</Label>
          <Switch id="highlight" checked={highlight} onCheckedChange={setHighlight} />
        </div>
        <div className="space-y-2">
          <Label>导出格式</Label>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox 
                id="pdf" 
                checked={exportFormats.pdf} 
                onCheckedChange={(checked) => setExportFormats(prev => ({ ...prev, pdf: !!checked }))} 
              />
              <Label htmlFor="pdf">PDF</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="docx" 
                checked={exportFormats.docx} 
                onCheckedChange={(checked) => setExportFormats(prev => ({ ...prev, docx: !!checked }))} 
              />
              <Label htmlFor="docx">Word</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox 
                id="xlsx" 
                checked={exportFormats.xlsx} 
                onCheckedChange={(checked) => setExportFormats(prev => ({ ...prev, xlsx: !!checked }))} 
              />
              <Label htmlFor="xlsx">Excel</Label>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="gap-1" onClick={handleSaveConfig}>
          <Settings className="size-4" />保存配置
        </Button>
        <Button onClick={onReanalyze} className="gap-1" disabled={analyzing}>
          <Sparkles className="size-4" />{analyzing ? "重新分析中..." : "重新分析"}
        </Button>
      </CardFooter>
    </Card>
  );
}

/** 根组件 **/
export default function App() {
  const [items, setItems] = useState<any[]>([
    { id:"a1", title:"(示例) 服务合同纠纷 — 甲公司诉乙公司", status:"已分析", meta:MOCK_SUMMARY.caseMeta, raw:MOCK_CASE_TEXT, summary:MOCK_SUMMARY, __json:null }
  ]);
  const [activeId, setActiveId] = useState("a1");
  const activeItem = useMemo(() => items.find((i) => i.id === activeId) || items[0], [items, activeId]);
  const [query, setQuery] = useState("");
  const [interpretText, setInterpretText] = useState("");
  const [interpretResult, setInterpretResult] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  /** 调用后端分析函数 **/
  async function analyzeText(rawText: string) {
  if (!rawText?.trim()) { alert("没有可分析的文本"); return; }
  const mode = (window as any).__analysisMode || "lawyer";
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, text: rawText })
    });

    const raw = await res.text();

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("Non-JSON response:", raw);
      alert("服务端返回了非 JSON 响应，请稍后重试或联系维护者。");
      return;
    }

    if (!res.ok || (data && data.ok === false)) {
      const msg = data?.error || data?.reason || "分析失败";
      alert(`分析失败: ${msg}`);
      return;
    }

    const json = data;
    setItems(prev => prev.map(it => it.id === activeId ? { ...it, __json: json, status: "已分析" } : it));
  } catch (e) {
    console.error(e);
    alert("分析失败，请检查 /api/analyze 与 Key/额度");
  }
}

  /** 即时解读功能 **/
  async function handleInterpret() {
    if (!interpretText?.trim()) return alert("请输入要解读的文本");
    setInterpreting(true);
    try {
      const res = await fetch("/api/analyze", { 
        method:"POST", 
        headers:{ "Content-Type":"application/json" }, 
        body: JSON.stringify({ 
          mode: "public", 
          text: interpretText 
        }) 
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      const result = typeof data === "string" ? sanitizeToJson(data) : data;
      setInterpretResult(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error("Interpret error:", e);
      const errorMessage = e?.message || "解读失败，请检查网络连接和API配置";
      setInterpretResult(`解读失败: ${errorMessage}`);
    } finally {
      setInterpreting(false);
    }
  }

  async function handleGeneratePoints() {
    if (!interpretText?.trim()) return alert("请输入要生成要点的文本");
    setInterpreting(true);
    try {
      const res = await fetch("/api/analyze", { 
        method:"POST", 
        headers:{ "Content-Type":"application/json" }, 
        body: JSON.stringify({ 
          mode: "lawyer", 
          text: interpretText 
        }) 
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      const result = typeof data === "string" ? sanitizeToJson(data) : data;
      setInterpretResult(JSON.stringify(result, null, 2));
    } catch (e: any) {
      console.error("Generate points error:", e);
      const errorMessage = e?.message || "生成要点失败，请检查网络连接和API配置";
      setInterpretResult(`生成要点失败: ${errorMessage}`);
    } finally {
      setInterpreting(false);
    }
  }

  /** 导出 **/
  function exportMarkdown(it:any) {
    const title = it?.title || "report";
    const json = it?.__json ? JSON.stringify(it.__json, null, 2) : "(尚无结构化结果)";
    const md = `# 判决书分析报告\n\n**标题**：${title}\n\n## 原文（节选）\n\n${(it?.raw || "").slice(0, 1000)}\n\n## 结构化结果\n\n\`\`\`json\n${json}\n\`\`\`\n`;
    download(`${title}.md`, md, "text/markdown;charset=utf-8");
  }
  function exportJSON(it:any) {
    const title = it?.title || "report";
    const json = it?.__json ? JSON.stringify(it.__json, null, 2) : "{}";
    download(`${title}.json`, json, "application/json;charset=utf-8");
  }

  /** 批量导入功能 **/
  function handleBatchImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.txt,text/plain';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) return;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const text = await file.text();
          const id = Math.random().toString(36).slice(2, 9);
          const item = { 
            id, 
            title: file.name, 
            status: "待分析", 
            meta: {}, 
            raw: text, 
            summary: MOCK_SUMMARY 
          };
          setItems(prev => [item, ...prev]);
        } catch (err: any) {
          console.error(`Failed to import ${file.name}:`, err);
        }
      }
      alert(`成功导入 ${files.length} 个文件`);
    };
    input.click();
  }

  /** 重新索引功能 **/
  function handleReindex() {
    setItems(prev => prev.map(item => ({
      ...item,
      status: item.status === "已分析" ? "待重新分析" : item.status
    })));
    alert("已重新索引，请重新分析需要更新的案件");
  }

  const filteredItems = useMemo(() => !query ? items : items.filter((i) => (i.title + JSON.stringify(i.meta)).includes(query)), [items, query]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-4 md:p-8">
      <div className="mx-auto max-w-[1280px] space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="size-9 grid place-items-center rounded-2xl bg-black text-white"><Scale className="size-4" /></div>
            <div><div className="text-xl font-semibold">Judgment Analyzer</div><div className="text-xs text-muted-foreground">判决书自动分析 · MVP（Edge API 已接通）</div></div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索：案号/法院/案由/标题…" />
            <Button variant="secondary" className="gap-1 w-full md:w-auto" onClick={() => setQuery("")} disabled={!query}><Search className="size-4" />清除搜索</Button>
          </div>
        </div>
        {/* Top Actions */}
        <div className="grid md:grid-cols-3 gap-4">
          <Uploader onUploaded={(item) => { setItems((prev) => [{ ...item }, ...prev]); setActiveId(item.id); }} onAnalyze={(rawText) => analyzeText(rawText)} analyzing={analyzing} />
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-lg">快捷操作</CardTitle><CardDescription>批量分析 / 模板导出</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Button variant="outline" className="justify-start gap-2" onClick={handleBatchImport}><FileText className="size-4" />批量导入</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => exportMarkdown(activeItem)}><Download className="size-4" />导出报告(MD)</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={() => exportJSON(activeItem)}><Share2 className="size-4" />导出JSON</Button>
              <Button variant="outline" className="justify-start gap-2" onClick={handleReindex}><RefreshCw className="size-4" />重新索引</Button>
            </CardContent>
          </Card>
          <RightPanelControls onReanalyze={() => analyzeText((items.find(i => i.id === activeId) || items[0]).raw)} analyzing={analyzing} />
        </div>
        {/* Main section */}
        <div className="grid md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="md:col-span-1 lg:col-span-2"><Sidebar items={filteredItems} activeId={activeItem?.id} onSelect={setActiveId} /></div>
          <div className="md:col-span-2 lg:col-span-3">
            <Tabs defaultValue="summary">
              <TabsList className="grid w-full grid-cols-3"><TabsTrigger value="summary">摘要视图</TabsTrigger><TabsTrigger value="raw">原文视图</TabsTrigger><TabsTrigger value="visual">可视化</TabsTrigger></TabsList>
              <TabsContent value="summary"><SummaryView data={activeItem.summary} json={activeItem.__json} onExportMD={() => exportMarkdown(activeItem)} onExportJSON={() => exportJSON(activeItem)} /></TabsContent>
              <TabsContent value="raw"><RawView text={activeItem.raw} /></TabsContent>
              <TabsContent value="visual"><VisualView data={activeItem.summary} /></TabsContent>
            </Tabs>
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <Card className="rounded-2xl h-full">
              <CardHeader><CardTitle className="text-lg">即时解读</CardTitle><CardDescription>选中文本 → 一键问答</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                <Textarea 
                  placeholder="在这里输入/粘贴任意段落，获取 AI 通俗解读与要点…" 
                  value={interpretText} 
                  onChange={(e) => setInterpretText(e.target.value)}
                  disabled={interpreting}
                />
                <div className="flex gap-2">
                  <Button className="gap-1" onClick={handleInterpret} disabled={!interpretText || interpreting}>
                    <Sparkles className="size-4" />{interpreting ? "解读中..." : "解读"}
                  </Button>
                  <Button variant="outline" className="gap-1" onClick={handleGeneratePoints} disabled={!interpretText || interpreting}>
                    <Brain className="size-4" />{interpreting ? "生成中..." : "生成要点"}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">支持：释义、要点、对方可能抗辩、可引用法条</div>
                {interpretResult && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-medium text-foreground">AI 解读结果</div>
                    <Card className="bg-muted/40">
                      <CardContent className="p-3">
                        <pre className="text-xs overflow-auto max-h-48 whitespace-pre-wrap">{interpretResult}</pre>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="text-center text-xs text-muted-foreground pt-6">© 2025 LexSmile · Prototype · 本原型仅展示交互与信息架构，非法律意见</div>
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
      {children}
    </span>
  );
}

