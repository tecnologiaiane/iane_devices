import React, { useState } from 'react';
import { dataService } from '../services/dataStorage';
import { formatDate } from '../utils/formatters';
import {
  Settings,
  FileSpreadsheet,
  Download,
  Upload,
  RotateCcw,
  ShieldCheck,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
  Server
} from 'lucide-react';

interface SettingsViewProps {
  onOpenSpreadsheetModal: () => void;
  onDataReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onOpenSpreadsheetModal,
  onDataReset,
}) => {
  const [auditLogs, setAuditLogs] = useState(dataService.getAuditLogs());
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleDownloadBackup = () => {
    const json = dataService.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_telecomasset_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = dataService.importFullBackup(content);
      if (res.success) {
        setSuccessMessage(res.message);
        setErrorMessage('');
        setAuditLogs(dataService.getAuditLogs());
        onDataReset();
      } else {
        setErrorMessage(res.message);
        setSuccessMessage('');
      }
    };
    reader.readAsText(file);
  };

  const handleResetDefaults = () => {
    if (window.confirm('Atenção: Isso restaurará todos os dados fictícios originais de demonstração (aparelhos, linhas, colaboradores e movimentações). Deseja continuar?')) {
      dataService.resetToDefaults();
      setAuditLogs(dataService.getAuditLogs());
      setSuccessMessage('Base de demonstração restaurada para os padrões originais com sucesso.');
      onDataReset();
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Messages */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Production Architecture Notice */}
      <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 shadow-md">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Server className="w-5 h-5" />
          </div>
          <div className="space-y-1.5 text-xs">
            <h2 className="text-sm font-bold text-white">
              Arquitetura Operacional do Protótipo & Roadmap de Produção
            </h2>
            <p className="text-slate-300 leading-relaxed">
              Nesta primeira fase, a aplicação armazena e simula todas as operações de maneira íntegra e atômica diretamente no navegador (armazenamento local). A arquitetura foi estruturada em camadas desacopladas (Serviço de Repositório de Dados, Regras de Negócio e Validações Patrimoniais), permitindo conectá-la a uma base de dados centralizada corporativa (ex.: PostgreSQL / Cloud SQL ou Firestore) e autenticação SSO (Google Workspace) com perfis de acesso (Administrador TI, Auditor e Consulta) nas etapas seguintes.
            </p>
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Migração da Planilha Atual */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Assistente de Migração da Planilha Existente
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Importe os dados das abas <strong>Base de Dados</strong> e <strong>Analítico</strong>. O assistente analisa o cabeçalho das colunas, detecta números de telefone, fabricantes e valida IMEIs duplicados antes de confirmar a importação.
            </p>
          </div>

          <button
            onClick={onOpenSpreadsheetModal}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Abrir Mapeador de Planilha (CSV)</span>
          </button>
        </div>

        {/* 2. Backup & Restauração JSON */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <Database className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Backup e Restauração de Dados
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Exporte todos os registros do sistema (aparelhos, linhas, colaboradores, termos e movimentações) em arquivo JSON seguro para contingência ou restaure um backup anterior.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadBackup}
              className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Baixar Backup</span>
            </button>

            <label className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Upload className="w-3.5 h-3.5 text-slate-600" />
              <span>Restaurar Backup</span>
              <input
                type="file"
                accept=".json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Reset Demo Data & Audit Log */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Restaurar Dados Fictícios Originais</h3>
          </div>
          <button
            onClick={handleResetDefaults}
            className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
          >
            Restaurar Base de Demonstração
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Utilize caso deseje resetar testes realizados e recarregar os exemplos fictícios de aparelhos (Apple, Samsung, Motorola), linhas (Vivo, Claro, TIM) e colaboradores.
        </p>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Trilha de Auditoria do Sistema</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {auditLogs.length} eventos registrados
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] sticky top-0">
              <tr>
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Entidade</th>
                <th className="py-2.5 px-3">Identificador</th>
                <th className="py-2.5 px-3">Operação / Detalhes</th>
                <th className="py-2.5 px-3">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-2 px-3 font-semibold text-slate-800">{log.entityType}</td>
                  <td className="py-2 px-3 font-mono text-blue-700">{log.entityLabel}</td>
                  <td className="py-2 px-3 text-slate-700">{log.details}</td>
                  <td className="py-2 px-3 text-slate-500">{log.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
