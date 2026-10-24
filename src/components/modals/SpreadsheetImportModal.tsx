import React, { useState } from 'react';
import { Modal } from '../Modal';
import { dataService } from '../../services/dataStorage';
import { FileSpreadsheet, Upload, CheckCircle2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Device, PhoneLine, Collaborator } from '../../types';

interface SpreadsheetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type TabSource = 'base_de_dados' | 'analitico';

export const SpreadsheetImportModal: React.FC<SpreadsheetImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeTabSource, setActiveTabSource] = useState<TabSource>('base_de_dados');
  const [csvContent, setCsvContent] = useState<string>('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Field mappings
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});
  const [importSummary, setImportSummary] = useState<{
    devicesCount: number;
    linesCount: number;
    collabsCount: number;
    errors: string[];
  } | null>(null);

  // Sample templates for demonstration
  const sampleBaseDeDados = `TAG;MARCA;MODELO;IMEI_1;NUMERO_SERIE;NUMERO_LINHA;OPERADORA;STATUS_APARELHO;STATUS_LINHA
CEL-020;Samsung;Galaxy A54 5G;359123456789011;RZ8T9900MM;11989001122;Vivo;Disponível;Disponível
CEL-021;Apple;iPhone 13 128GB;359234567890122;DX3F9K999;11989003344;Claro;Disponível;Disponível
CEL-022;Motorola;Moto G84 5G;359345678901233;ZY224K555;11989005566;TIM;Disponível;Disponível`;

  const sampleAnalitico = `TAG_APARELHO;COLABORADOR;MATRICULA;DEPARTAMENTO;LINHA;DATA_ENTREGA;TERMO_REF
CEL-025;Renato Silveira;MAT-1300;Logística;11989007788;2024-05-10;TERMO-ENT-025
CEL-026;Camila Nogueira;MAT-1310;Comercial;11989008899;2024-05-15;TERMO-ENT-026`;

  const loadSample = () => {
    if (activeTabSource === 'base_de_dados') {
      setCsvContent(sampleBaseDeDados);
    } else {
      setCsvContent(sampleAnalitico);
    }
  };

  const handleParseCsv = () => {
    if (!csvContent.trim()) return;

    // Detect separator (; or ,)
    const firstLine = csvContent.split('\n')[0];
    const sep = firstLine.includes(';') ? ';' : ',';

    const lines = csvContent
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    if (lines.length < 2) {
      alert('O CSV deve conter pelo menos uma linha de cabeçalho e uma linha de dados.');
      return;
    }

    const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = lines.slice(1).map(line => line.split(sep).map(cell => cell.trim().replace(/^"|"$/g, '')));

    setParsedHeaders(headers);
    setParsedRows(rows);

    // Auto-map based on common header names
    const initialMap: Record<string, string> = {};
    headers.forEach((h) => {
      const lower = h.toLowerCase();
      if (lower.includes('tag') || lower.includes('ativo') || lower.includes('patrimonio')) {
        initialMap[h] = 'assetTag';
      } else if (lower.includes('imei')) {
        initialMap[h] = 'imei1';
      } else if (lower.includes('marca')) {
        initialMap[h] = 'brand';
      } else if (lower.includes('modelo')) {
        initialMap[h] = 'model';
      } else if (lower.includes('serie') || lower.includes('serial')) {
        initialMap[h] = 'serialNumber';
      } else if (lower.includes('linha') || lower.includes('telefone') || lower.includes('numero')) {
        initialMap[h] = 'phoneNumber';
      } else if (lower.includes('operadora')) {
        initialMap[h] = 'carrier';
      } else if (lower.includes('colaborador') || lower.includes('responsavel') || lower.includes('nome')) {
        initialMap[h] = 'collaboratorName';
      } else if (lower.includes('matricula')) {
        initialMap[h] = 'registrationNumber';
      } else if (lower.includes('departamento') || lower.includes('area') || lower.includes('setor')) {
        initialMap[h] = 'department';
      } else if (lower.includes('status_aparelho') || lower.includes('status_dispositivo')) {
        initialMap[h] = 'deviceStatus';
      } else if (lower.includes('status_linha')) {
        initialMap[h] = 'lineStatus';
      }
    });

    setFieldMappings(initialMap);
    setStep(2);
  };

  const handleExecuteImport = () => {
    const devicesToImport: Partial<Device>[] = [];
    const linesToImport: Partial<PhoneLine>[] = [];
    const collabsToImport: Partial<Collaborator>[] = [];

    parsedRows.forEach((row) => {
      const rowData: Record<string, string> = {};
      parsedHeaders.forEach((h, idx) => {
        const targetField = fieldMappings[h];
        if (targetField && targetField !== 'ignore') {
          rowData[targetField] = row[idx] || '';
        }
      });

      // Se mapeou colaborador
      if (rowData.collaboratorName) {
        collabsToImport.push({
          fullName: rowData.collaboratorName,
          registrationNumber: rowData.registrationNumber || `MAT-${Math.floor(1000 + Math.random() * 9000)}`,
          department: rowData.department || 'Geral',
          position: 'Colaborador',
          corporateEmail: `${rowData.collaboratorName.toLowerCase().replace(/\s+/g, '.')}@empresa.com.br`,
          status: 'Ativo',
        });
      }

      // Se mapeou linha
      if (rowData.phoneNumber) {
        const rawPhone = rowData.phoneNumber.replace(/\D/g, '');
        let formatted = rowData.phoneNumber;
        if (rawPhone.length === 11) {
          formatted = `(${rawPhone.slice(0, 2)}) ${rawPhone.slice(2, 7)}-${rawPhone.slice(7)}`;
        }
        linesToImport.push({
          phoneNumber: formatted,
          carrier: (rowData.carrier as any) || 'Vivo',
          planName: 'Plano Corporativo Importado',
          status: (rowData.lineStatus as any) || 'Disponível',
          department: rowData.department,
        });
      }

      // Se mapeou aparelho
      if (rowData.assetTag || rowData.imei1) {
        devicesToImport.push({
          assetTag: rowData.assetTag || `CEL-${Math.floor(100 + Math.random() * 900)}`,
          brand: rowData.brand || 'Samsung',
          model: rowData.model || 'Smartphone Corporativo',
          imei1: rowData.imei1 || `359000${Math.floor(100000000 + Math.random() * 900000000)}`,
          serialNumber: rowData.serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`,
          condition: 'Bom',
          status: (rowData.deviceStatus as any) || 'Disponível',
          currentDepartment: rowData.department,
        });
      }
    });

    const result = dataService.importFromSpreadsheetData({
      devices: devicesToImport,
      lines: linesToImport,
      collaborators: collabsToImport,
    });

    setImportSummary({
      devicesCount: result.importedDevices,
      linesCount: result.importedLines,
      collabsCount: result.importedCollaborators,
      errors: result.errors,
    });
    setStep(3);
  };

  const handleFinish = () => {
    onSuccess();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Assistente de Importação da Planilha Atual"
      subtitle="Migre com segurança os dados das abas Base de Dados e Analítico"
      maxWidth="4xl"
    >
      <div className="space-y-4">
        {/* Step indicator */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">1</span>
            <span>Entrada de Dados (CSV)</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">2</span>
            <span>Mapeamento de Colunas</span>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
          <div className={`flex items-center gap-2 ${step === 3 ? 'text-blue-600 font-semibold' : 'text-slate-400'}`}>
            <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px]">3</span>
            <span>Validação e Conclusão</span>
          </div>
        </div>

        {/* STEP 1: Paste CSV or Load Sample */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Origem da Planilha:</span>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTabSource('base_de_dados');
                      setCsvContent('');
                    }}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      activeTabSource === 'base_de_dados'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aba: Base de Dados (Ativos & Linhas)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTabSource('analitico');
                      setCsvContent('');
                    }}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      activeTabSource === 'analitico'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Aba: Analítico (Acompanhamento & Responsáveis)
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={loadSample}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Carregar Exemplo de Teste</span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cole o conteúdo CSV exportado do Excel (separado por vírgula ou ponto e vírgula):
              </label>
              <textarea
                rows={9}
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                placeholder="TAG;MARCA;MODELO;IMEI_1;NUMERO_SERIE;NUMERO_LINHA..."
                className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-white p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <p className="font-semibold mb-1">Como migrar da planilha existente:</p>
              <p className="text-[11px] leading-relaxed">
                Abra sua planilha corporativa no Excel ou Google Sheets, clique em <strong>Arquivo &gt; Salvar Como &gt; CSV (separado por ponto e vírgula)</strong>. Em seguida, copie o conteúdo e cole na caixa acima. Na próxima etapa você poderá relacionar as colunas existentes aos campos do sistema.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!csvContent.trim()}
                onClick={handleParseCsv}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>Avançar para Mapeamento</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Map Fields */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600">
              Foram identificadas <strong>{parsedRows.length} linhas</strong> de dados e <strong>{parsedHeaders.length} colunas</strong>. Relacione cada coluna da sua planilha ao campo correspondente do sistema:
            </p>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-slate-700">Coluna na Planilha</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-700">Exemplo da 1ª Linha</th>
                    <th className="py-2.5 px-3 font-semibold text-slate-700">Campo no Sistema</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedHeaders.map((header, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-medium text-slate-900">{header}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px] truncate max-w-[150px]">
                        {parsedRows[0]?.[idx] || '-'}
                      </td>
                      <td className="py-2 px-3">
                        <select
                          value={fieldMappings[header] || 'ignore'}
                          onChange={(e) => {
                            setFieldMappings({
                              ...fieldMappings,
                              [header]: e.target.value,
                            });
                          }}
                          className="w-full text-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="ignore">-- Ignorar Coluna --</option>
                          <optgroup label="Dispositivo">
                            <option value="assetTag">Identificador do Ativo (Tag / CEL-xxx)</option>
                            <option value="brand">Marca do Aparelho</option>
                            <option value="model">Modelo do Aparelho</option>
                            <option value="imei1">IMEI 1 (Principal)</option>
                            <option value="serialNumber">Número de Série</option>
                            <option value="deviceStatus">Status do Aparelho</option>
                          </optgroup>
                          <optgroup label="Linha Telefônica">
                            <option value="phoneNumber">Número da Linha</option>
                            <option value="carrier">Operadora</option>
                            <option value="lineStatus">Status da Linha</option>
                          </optgroup>
                          <optgroup label="Colaborador & Lotação">
                            <option value="collaboratorName">Nome do Colaborador / Responsável</option>
                            <option value="registrationNumber">Matrícula</option>
                            <option value="department">Departamento</option>
                          </optgroup>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleExecuteImport}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5"
              >
                <span>Validar e Importar Registros</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Summary & Results */}
        {step === 3 && importSummary && (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Processamento da Planilha Concluído com Sucesso!</span>
              </div>
              <p className="text-xs text-emerald-800">
                Os registros foram validados, sanitizados e integrados à base de dados operacional do sistema.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-xs text-slate-500 font-medium">Aparelhos Importados</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{importSummary.devicesCount}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-xs text-slate-500 font-medium">Linhas Importadas</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{importSummary.linesCount}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="text-xs text-slate-500 font-medium">Colaboradores Importados</div>
                <div className="text-xl font-bold font-mono text-slate-900 mt-1">{importSummary.collabsCount}</div>
              </div>
            </div>

            {importSummary.errors.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Avisos de Validação ({importSummary.errors.length}):</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px] max-h-32 overflow-y-auto">
                  {importSummary.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleFinish}
                className="px-6 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs"
              >
                Concluir e Atualizar Visões
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
