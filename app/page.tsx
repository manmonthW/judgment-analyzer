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

// Document processing imports - dynamic imports to avoid SSR issues
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, UnderlineType } from "docx";
import { saveAs } from "file-saver";

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

/** 文档解析函数 **/
async function parseWordDocument(file: File): Promise<string> {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`Word文档解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

async function parsePdfDocument(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Try different worker sources in order of preference
    const workerSources = [
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`,
      `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`,
      // Fallback: disable worker (slower but more compatible)
      null
    ];
    
    let pdf;
    let workerConfigured = false;
    
    for (const workerSrc of workerSources) {
      try {
        if (typeof window !== 'undefined' && workerSrc && !workerConfigured) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
          workerConfigured = true;
        }
        
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({
          data: arrayBuffer,
          useSystemFonts: false,
          disableFontFace: false,
          verbosity: 0,
          // Disable worker if no worker source available
          useWorkerFetch: !!workerSrc,
          isEvalSupported: false
        });
        
        pdf = await loadingTask.promise;
        break; // Success, exit loop
      } catch (workerError) {
        console.warn('PDF worker failed, trying next option:', workerError);
        // Try next worker source or fallback
        continue;
      }
    }
    
    if (!pdf) {
      throw new Error('无法加载PDF文档，所有解析方式都失败了');
    }
    
    let fullText = '';
    
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF parsing error:', error);
    
    // Provide helpful error message with alternatives
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    throw new Error(`PDF文档解析失败: ${errorMessage}。建议：请尝试将PDF转换为Word格式或复制文本内容到txt文件后重新上传。`);
  }
}

async function parseTextDocument(file: File): Promise<string> {
  try {
    return await file.text();
  } catch (error) {
    throw new Error(`文本文档解析失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

async function parseDocument(file: File): Promise<string> {
  const fileExtension = file.name.toLowerCase().split('.').pop();
  
  switch (fileExtension) {
    case 'docx':
    case 'doc':
      return await parseWordDocument(file);
    case 'pdf':
      return await parsePdfDocument(file);
    case 'txt':
      return await parseTextDocument(file);
    default:
      throw new Error(`不支持的文件格式: ${fileExtension}`);
  }
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
function Uploader({ onUploaded, onAnalyze, analyzing }: { 
  onUploaded: (item: any) => void; 
  onAnalyze: (rawText: string) => void; 
  analyzing: boolean; 
}) {
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState("");
  const [localText, setLocalText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  async function readFileToText(file: File) {
    const fileName = file.name.toLowerCase();
    const supportedExtensions = ['.txt', '.docx', '.doc', '.pdf'];
    const hasValidExtension = supportedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      throw new Error("仅支持 Word (.docx, .doc)、PDF (.pdf)、文本 (.txt) 格式文件");
    }
    
    return await parseDocument(file);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = fileRef.current;
    const f = e.target.files?.[0];
    if (!f) { 
      if (input) input.value = ""; 
      return; 
    }
    
    setUploading(true);
    try {
      const text = await readFileToText(f);
      setLocalText(text);
      setSelectedFileName(f.name);
      
      const id = Math.random().toString(36).slice(2, 9);
      const newItem = { 
        id, 
        title: f.name, 
        status: "待分析", 
        meta: {}, 
        raw: text, 
        summary: MOCK_SUMMARY 
      };
      
      onUploaded(newItem);
      console.log("File uploaded successfully, text length:", text.length);
    } catch (err: any) {
      console.error("File reading error:", err);
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
      if (!r.ok) {
        throw new Error(`HTTP ${r.status}: ${r.statusText}`);
      }
      
      const html = await r.text();
      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      
      setLocalText(text);
      setSelectedFileName(`抓取自: ${url}`);
      
      const id = Math.random().toString(36).slice(2, 9);
      const newItem = { 
        id, 
        title: url, 
        status: "待分析", 
        meta: {}, 
        raw: text, 
        summary: MOCK_SUMMARY 
      };
      
      onUploaded(newItem);
      setUrl("");
      console.log("URL content fetched successfully, text length:", text.length);
    } catch (error: any) {
      console.error("URL fetch error:", error);
      alert(`抓取失败: ${error.message}`);
    } finally { 
      setUploading(false); 
    }
  }

  const handleAnalyze = () => {
    if (!localText) {
      alert("请先上传文件或抓取网页内容");
      return;
    }
    console.log("Starting analysis with text length:", localText.length);
    onAnalyze(localText);
  };

  const handleReset = () => {
    setLocalText(""); 
    setSelectedFileName("");
    setUrl("");
    if (fileRef.current) fileRef.current.value = ""; 
    console.log("Upload state reset");
  };

  return (
    <Card className="rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50 to-transparent">
      <CardHeader className="text-center">
        <CardTitle className="text-xl flex items-center justify-center gap-2">
          <FileUp className="size-6 text-blue-600" />
          上传判决书开始分析
        </CardTitle>
        <CardDescription className="text-base">
          支持文本文件上传或网页链接抓取，AI将自动提取和分析关键信息
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <input 
            ref={fileRef} 
            type="file" 
            accept=".txt,.docx,.doc,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" 
            onChange={handleFile} 
            className="hidden" 
          />
          
          {/* File Upload Area */}
          <div 
            className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors cursor-pointer"
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <FileUp className="size-12 text-slate-400 mx-auto mb-4" />
            <div className="text-lg font-medium mb-2">
              {selectedFileName || "点击选择文件或拖拽到此处"}
            </div>
            <div className="text-sm text-muted-foreground">
              支持 Word (.docx, .doc)、PDF (.pdf)、文本 (.txt) 格式
            </div>
            {selectedFileName && (
              <div className="mt-3 px-4 py-2 bg-muted rounded-lg inline-block">
                <div className="text-sm font-medium">{selectedFileName}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* URL Input Section */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input 
              placeholder="或输入网页链接进行抓取..." 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              disabled={uploading}
              className="h-12 text-base"
            />
          </div>
          <Button 
            variant="secondary" 
            onClick={handleFetchUrl} 
            className="gap-2 h-12 px-6" 
            disabled={!url || uploading}
          >
            <Link2 className="size-4" />
            抓取内容
          </Button>
        </div>
        
        {uploading && (
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">正在处理文本…</div>
            <Progress value={66} />
          </div>
        )}
        
        {localText && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-emerald-700">文本已载入</div>
                <div className="text-sm text-emerald-600">
                  共 {localText.length.toLocaleString()} 字符
                </div>
              </div>
              <div className="text-emerald-600">
                <FileText className="size-6" />
              </div>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col gap-3">
        <div className="flex gap-3 w-full">
          <Button 
            variant="outline" 
            className="flex-1 gap-2" 
            onClick={handleReset}
          >
            <RefreshCw className="size-4" />
            重置
          </Button>
          <Button 
            className="flex-1 gap-2 text-base h-12" 
            onClick={handleAnalyze} 
            disabled={!localText || analyzing}
            size="lg"
          >
            <Brain className="size-5" />
            {analyzing ? "AI分析中..." : "开始AI分析"}
          </Button>
        </div>
        {analyzing && (
          <div className="w-full text-center text-sm text-muted-foreground">
            正在使用AI分析判决书内容，请耐心等待...
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
/** 摘要视图 **/
function SummaryView({ data, json, onExportMD, onExportJSON }:{ data: any; json?: any; onExportMD: () => void; onExportJSON: () => void; }) {
  // 适配不同的数据结构：AI返回的数据 vs MOCK数据
  const caseMeta = data?.case_meta || data?.caseMeta || {};
  const parties = data?.parties || [];
  const focusPoints = data?.focusPoints || data?.issues || [];
  const statutes = data?.statutes || [];
  const decision = data?.decision || data?.holdings || "暂无判决结果";
  const risk = data?.risk || (data?.risks && data.risks[0]) || { level: "未知", notes: [] };

  return (
    <Card className="h-full rounded-2xl">
      <CardHeader><CardTitle className="text-lg">AI 摘要</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Pill>案号：{caseMeta.case_no || caseMeta.caseNo || "未知"}</Pill>
          <Pill>法院：{caseMeta.court || "未知"}</Pill>
          <Pill>日期：{caseMeta.date || "未知"}</Pill>
          <Pill>案由：{caseMeta.cause || "未知"}</Pill>
        </div>
        {/* Parties */}
        <SectionTitle icon={ListTree} title="当事人" />
        <div className="flex flex-wrap gap-2">
          {parties.map((p: any, i: number) => (
            <Badge key={i} variant="secondary">{p.role} · {p.name}</Badge>
          ))}
          {parties.length === 0 && <div className="text-sm text-muted-foreground">暂无当事人信息</div>}
        </div>
        {/* Issues */}
        <SectionTitle icon={Workflow} title="争议焦点" />
        <div className="space-y-3">
          {Array.isArray(focusPoints) && focusPoints.map((f: any, i: number) => {
            if (typeof f === 'string') {
              // 简单字符串格式（issues数组）
              return (
                <div key={i} className="rounded-2xl border p-3">
                  <div className="font-medium mb-1">{i + 1}. {f}</div>
                </div>
              );
            } else if (f.title) {
              // 复杂对象格式（focusPoints数组）
              return (
                <div key={i} className="rounded-2xl border p-3">
                  <div className="font-medium mb-1">{i + 1}. {f.title}</div>
                  <div className="grid md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                    <div><span className="font-medium text-foreground">原告：</span>{f.plaintiff}</div>
                    <div><span className="font-medium text-foreground">被告：</span>{f.defendant}</div>
                    <div><span className="font-medium text-foreground">法院意见：</span>{f.court}</div>
                  </div>
                </div>
              );
            }
            return null;
          })}
          {focusPoints.length === 0 && <div className="text-sm text-muted-foreground">暂无争议焦点</div>}
        </div>
        {/* Statutes */}
        <SectionTitle icon={BookOpen} title="法律条款与通俗解读" />
        <div className="space-y-2 text-sm">
          {statutes.map((s: any, i: number) => (
            <div key={i} className="rounded-2xl border p-3 flex items-start gap-3">
              <Scale className="size-4 mt-1" />
              <div>
                <div className="font-medium">{s.law} · {s.article}</div>
                <div className="text-muted-foreground">
                  {s.explain || s.application_reasoning || s.quote_or_ref || "暂无解释"}
                </div>
              </div>
            </div>
          ))}
          {statutes.length === 0 && <div className="text-sm text-muted-foreground">暂无法律条款</div>}
        </div>
        {/* Decision */}
        <SectionTitle icon={ChevronRight} title="裁判结果" />
        <Card className="border-dashed">
          <CardContent className="p-4 text-sm">{decision}</CardContent>
        </Card>
        {/* Risk */}
        <SectionTitle icon={ShieldAlert} title="风险与建议" />
        <div className="flex items-center gap-3">
          <Badge variant="destructive">风险：{risk.level || "未知"}</Badge>
          <ul className="list-disc text-sm text-muted-foreground pl-5">
            {(risk.notes || []).map((n: string, i: number) => <li key={i}>{n}</li>)}
            {(!risk.notes || risk.notes.length === 0) && <li>暂无风险建议</li>}
          </ul>
        </div>
      </CardContent>
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
  
  useEffect(() => { (window as any).__analysisMode = mode; }, [mode]);

  const handleSaveConfig = () => {
    const config = {
      mode,
      normalize,
      highlight,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('judgment-analyzer-config', JSON.stringify(config));
    alert('配置已保存到本地存储');
  };

  return (
    <div className="space-y-4">
      <AnalysisModeSelector onChange={(m) => setMode(m)} value={mode} />
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="normalize">术语通俗化</Label>
          <Switch id="normalize" checked={normalize} onCheckedChange={setNormalize} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="highlight">原文关键字高亮</Label>
          <Switch id="highlight" checked={highlight} onCheckedChange={setHighlight} />
        </div>
      </div>
      
      <Button 
        variant="outline" 
        className="w-full gap-1" 
        onClick={handleSaveConfig}
      >
        <Settings className="size-4" />
        保存配置
      </Button>
    </div>
  );
}

/** 根组件 **/
export default function App() { const [pendingRaw, setPendingRaw] = useState<string>("");
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
  if (!rawText?.trim()) { 
    alert("没有可分析的文本"); 
    return; 
  }
  
  setAnalyzing(true);
  const mode = (window as any).__analysisMode || "lawyer";
  
  try {
    console.log("Starting analysis request:", { mode, textLength: rawText.length });
    
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, text: rawText })
    });

    console.log("Response status:", res.status, res.statusText);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: "网络请求失败" }));
      console.error("API Error Response:", errorData);
      alert(`分析失败 (${res.status}): ${errorData.error || res.statusText}`);
      return;
    }

    let data: any;
    try {
      const responseText = await res.text();
      console.log("Raw response text:", responseText.substring(0, 200) + "...");
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      alert("服务端返回了无效的响应格式，请检查 API 配置");
      return;
    }

    if (data && data.ok === false) {
      console.error("API returned error:", data);
      alert(`分析失败: ${data.error || data.reason || "未知错误"}`);
      return;
    }

    console.log("Analysis successful, updating UI...");
    setItems(prev => prev.map(it => 
      it.id === activeId 
        ? { ...it, __json: data, status: "已分析" } 
        : it
    ));
    
    alert("分析完成！");
    
  } catch (e: any) {
    console.error("Analysis Error:", e);
    alert(`分析失败: ${e.message || "网络连接错误，请检查服务器状态"}`);
  } finally {
    setAnalyzing(false);
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
  async function exportToWord(item: any) {
    try {
      const title = item?.title || "判决书分析报告";
      const analysisData = item?.__json || item?.summary || {};
      
      // 适配数据结构
      const caseMeta = analysisData?.case_meta || analysisData?.caseMeta || {};
      const parties = analysisData?.parties || [];
      const focusPoints = analysisData?.focusPoints || analysisData?.issues || [];
      const statutes = analysisData?.statutes || [];
      const decision = analysisData?.decision || analysisData?.holdings || "暂无判决结果";
      const risk = analysisData?.risk || (analysisData?.risks && analysisData.risks[0]) || { level: "未知", notes: [] };

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // 标题
            new Paragraph({
              children: [
                new TextRun({
                  text: "判决书AI分析报告",
                  bold: true,
                  size: 36,
                }),
              ],
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // 案件基本信息
            new Paragraph({
              children: [
                new TextRun({
                  text: "案件基本信息",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 200 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "案号：", bold: true }),
                new TextRun({ text: caseMeta.case_no || caseMeta.caseNo || "未知" }),
              ],
              spacing: { after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "法院：", bold: true }),
                new TextRun({ text: caseMeta.court || "未知" }),
              ],
              spacing: { after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "审理日期：", bold: true }),
                new TextRun({ text: caseMeta.date || "未知" }),
              ],
              spacing: { after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "案由：", bold: true }),
                new TextRun({ text: caseMeta.cause || "未知" }),
              ],
              spacing: { after: 300 },
            }),

            // 当事人信息
            new Paragraph({
              children: [
                new TextRun({
                  text: "当事人信息",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 200 },
            }),

            ...parties.map((party: any) => new Paragraph({
              children: [
                new TextRun({ text: `${party.role}：`, bold: true }),
                new TextRun({ text: party.name || "未知" }),
              ],
              spacing: { after: 100 },
            })),

            // 争议焦点
            new Paragraph({
              children: [
                new TextRun({
                  text: "争议焦点",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 200 },
            }),

            ...focusPoints.map((point: any, index: number) => {
              if (typeof point === 'string') {
                return new Paragraph({
                  children: [
                    new TextRun({ text: `${index + 1}. `, bold: true }),
                    new TextRun({ text: point }),
                  ],
                  spacing: { after: 200 },
                });
              } else if (point.title) {
                return new Paragraph({
                  children: [
                    new TextRun({ text: `${index + 1}. ${point.title}`, bold: true }),
                  ],
                  spacing: { after: 100 },
                });
              }
              return new Paragraph({ children: [] });
            }),

            // 法律条款
            new Paragraph({
              children: [
                new TextRun({
                  text: "适用法律条款",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 200 },
            }),

            ...statutes.map((statute: any, index: number) => [
              new Paragraph({
                children: [
                  new TextRun({ text: `${index + 1}. ${statute.law} ${statute.article}`, bold: true }),
                ],
                spacing: { after: 100 },
              }),
              new Paragraph({
                children: [
                  new TextRun({ 
                    text: statute.explain || statute.application_reasoning || statute.quote_or_ref || "暂无解释",
                    italics: true,
                  }),
                ],
                spacing: { after: 200 },
              })
            ]).flat(),

            // 判决结果
            new Paragraph({
              children: [
                new TextRun({
                  text: "判决结果",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 200 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: decision }),
              ],
              spacing: { after: 300 },
            }),

            // 风险评估
            new Paragraph({
              children: [
                new TextRun({
                  text: "风险评估与建议",
                  bold: true,
                  size: 28,
                  underline: { type: UnderlineType.SINGLE },
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 200 },
            }),

            new Paragraph({
              children: [
                new TextRun({ text: "风险等级：", bold: true }),
                new TextRun({ text: risk.level || "未知" }),
              ],
              spacing: { after: 200 },
            }),

            ...(risk.notes || []).map((note: string, index: number) => new Paragraph({
              children: [
                new TextRun({ text: `${index + 1}. ` }),
                new TextRun({ text: note }),
              ],
              spacing: { after: 100 },
            })),

            // 生成信息
            new Paragraph({
              children: [
                new TextRun({
                  text: "报告生成信息",
                  bold: true,
                  size: 24,
                }),
              ],
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: `生成时间：${new Date().toLocaleString('zh-CN')}`,
                  italics: true,
                }),
              ],
              spacing: { after: 100 },
            }),

            new Paragraph({
              children: [
                new TextRun({
                  text: "本报告由Judgment Analyzer AI系统自动生成，仅供参考，不构成法律意见。",
                  italics: true,
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200 },
            }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      const blob = new Blob([buffer], { 
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
      });
      saveAs(blob, `${title.replace(/[^\w\s-]/g, '')}-分析报告.docx`);
      
    } catch (error) {
      console.error("Word文档导出失败:", error);
      alert("Word文档导出失败，请重试");
    }
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
    input.accept = '.txt,.docx,.doc,.pdf,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) return;
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const text = await parseDocument(file);
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
          alert(`导入 ${file.name} 失败: ${err.message}`);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 p-4 md:p-8">
      <div className="mx-auto max-w-[1280px] space-y-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="size-12 grid place-items-center rounded-2xl bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 text-white shadow-lg">
              <Scale className="size-6" />
            </div>
            <div>
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Judgment Analyzer
              </div>
              <div className="text-slate-600 font-medium">
                AI驱动的智能判决书分析工具
              </div>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="max-w-md mx-auto flex items-center gap-2">
            <Input 
              value={query} 
              onChange={(e) => setQuery(e.target.value)} 
              placeholder="搜索案件..." 
              className="h-10"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setQuery("")} 
              disabled={!query}
            >
              <Search className="size-4" />
            </Button>
          </div>
        </div>
        {/* Upload Section - Centered and Prominent */}
        <div className="max-w-4xl mx-auto">
          <Uploader onUploaded={(item) => { setItems((prev) => [{ ...item }, ...prev]); setActiveId(item.id); }} onAnalyze={(rawText) => analyzeText(rawText)} analyzing={analyzing} />
        </div>
        {/* Main Content Area */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Sidebar - Case List */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Sidebar items={filteredItems} activeId={activeItem?.id} onSelect={setActiveId} />
          </div>
          
          {/* Main Analysis Area */}
          <div className="lg:col-span-6 order-1 lg:order-2">
            <Tabs defaultValue="summary" className="h-full">
              <div className="flex items-center justify-between mb-4">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="summary">AI 摘要</TabsTrigger>
                  <TabsTrigger value="raw">原文</TabsTrigger>
                  <TabsTrigger value="visual">可视化</TabsTrigger>
                </TabsList>
                
                {/* Analysis Controls */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => analyzeText((items.find(i => i.id === activeId) || items[0]).raw)} 
                    disabled={analyzing}
                    className="gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Sparkles className="size-4" />
                    {analyzing ? "分析中..." : "重新分析"}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => exportToWord(activeItem)}
                    className="gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Download className="size-4" />
                    导出Word
                  </Button>
                </div>
              </div>
              
              <TabsContent value="summary" className="mt-0">
                <SummaryView 
                  data={activeItem.__json || activeItem.summary} 
                  json={activeItem.__json} 
                  onExportMD={() => exportMarkdown(activeItem)} 
                  onExportJSON={() => exportJSON(activeItem)} 
                />
              </TabsContent>
              <TabsContent value="raw" className="mt-0">
                <RawView text={activeItem.raw} />
              </TabsContent>
              <TabsContent value="visual" className="mt-0">
                <VisualView data={activeItem.summary} />
              </TabsContent>
            </Tabs>
          </div>
          
          {/* Right Panel - Settings & Quick Actions */}
          <div className="lg:col-span-3 order-3 space-y-4">
            {/* Analysis Mode Selector */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">分析设置</CardTitle>
              </CardHeader>
              <CardContent>
                <RightPanelControls 
                  onReanalyze={() => analyzeText((items.find(i => i.id === activeId) || items[0]).raw)} 
                  analyzing={analyzing} 
                />
              </CardContent>
            </Card>
            
            {/* Quick Actions */}
            <Card className="rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">快速操作</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2" 
                  onClick={handleBatchImport}
                >
                  <FileText className="size-4" />
                  批量导入文件
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2" 
                  onClick={handleReindex}
                >
                  <RefreshCw className="size-4" />
                  重新索引
                </Button>
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



