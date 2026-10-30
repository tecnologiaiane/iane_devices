# Regras fixas do projeto (GELIN)

## Escopo e design
- Execute SOMENTE o que o prompt pedir. Não altere telas, textos, rotas, dados ou componentes fora do pedido.
- Siga estritamente o design system atual: reutilize componentes, cores, tipografia, espaçamentos, ícones, tabelas, modais, badges e padrões de layout existentes. Sem estilos novos e sem novas dependências.
- Reaproveite a lógica existente. Não mude regras de negócio que o prompt não citou.
- Não apague dados já cadastrados. Campos removidos de formulários saem só da interface.
- Permissões, filtros de visibilidade e transições de status devem ser validados também no backend/camada de dados, não só na interface.
- Se algo estiver ambíguo, faça a menor alteração possível e registre a dúvida no final, sem inventar.

## Testes
- Use o framework de testes existente. Se não houver, valide manualmente cada cenário.
- Use dados de teste isolados e remova-os ao final.
- Se um teste falhar por código fora do escopo, apenas reporte.

## Economia de contexto
- Leia apenas os arquivos relevantes à tarefa. Não leia o projeto inteiro.
- Use busca (grep/glob) antes de abrir arquivos grandes e leia só os trechos necessários.
- Não cole arquivos inteiros nem diffs longos na resposta.
- Não repita nem reescreva o prompt recebido.
- Ao final, responda de forma curta: arquivos alterados, resumo por item, resultado dos testes, dúvidas e confirmação de que nada fora do escopo foi modificado.