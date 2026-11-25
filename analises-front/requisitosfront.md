ID	Tela ou componente	O que mostra e o que permite	Requisitos	Prioridade
F1	Painel do gestor	Cards com os quatro KPIs (custo por rota, custo por entrega, índice de perda, custo total de risco); filtros por rota, transportadora, motorista, horário e período; ranking e gráfico de custo por rota	RF13, RF14, RF15	Deve
F2	Lista de ocorrências	Ocorrências mais recentes, com tipo, rota, motorista, custo e status; a nova aparece sozinha durante a demo	RF05, RF13	Deve
F3	Detalhe da ocorrência	Campos extraídos com a confiança de cada um, transcrição, fotos, data e hash da evidência, custo da ocorrência, custo do seguro, status (completo, incompleto, em revisão)	RF04, RF05, RF08, RF09, RF10	Deve
F4	Pergunta do gestor (UC08)	Campo de pergunta em linguagem natural, resposta em R$ e um "como calculei" com a consulta usada	RF16	Deveria
F5	Fila de revisão	Registros de baixa confiança, com botões confirmar e corrigir campo	RF18	Deveria
F6	Padrões emergentes	Grupos de relatos parecidos, com custo e rota de cada grupo e um campo para o analista dar nome	RF19	Poderia
F7	Quem paga e prazo	Pagador indicado e data-limite de protesto, dentro do detalhe	RF21	[A DEFINIR]


Contratos entre front e back
Combinem isso primeiro. Com o contrato fechado, o front trabalha com respostas falsas no mesmo formato enquanto o back fica pronto.Chamada
Para quê
TelaBuscar KPIs, com dimensão (rota, transportadora, motorista, horário), período e filtrosCards, ranking e gráficoF1Listar ocorrências, com filtros e paginaçãoListaF2Avisar o front quando chega uma ocorrência nova (por consulta periódica ou push)Lista atualizando sozinha na demoF2Buscar uma ocorrência pelo númeroDetalheF3Enviar uma pergunta do gestorResposta e consulta usadaF4Confirmar ou corrigir um registroFila de revisãoF5Listar padrões e dar nome a um grupoPadrões emergentes