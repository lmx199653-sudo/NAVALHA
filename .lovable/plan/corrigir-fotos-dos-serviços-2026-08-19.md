# Corrigir fotos dos serviços

## Implementação
- Exibir no formulário de edição o banco de imagens padrão já enviado, associado aos nomes dos serviços.
- Permitir escolher uma imagem padrão, enviar uma nova foto ou colar uma URL, sempre com prévia antes de salvar.
- Permitir remover a foto personalizada e voltar automaticamente à imagem padrão, sem apagar os arquivos padrão do sistema.
- Salvar a imagem escolhida no serviço para que apareça no painel e no link público.
- Tornar o bucket `service-photos` adequado à exibição pública e restringir upload, alteração e exclusão aos membros da barbearia dona da pasta.
- Validar o fluxo no navegador após as alterações.

## Detalhes técnicos
- Novos uploads usarão a pasta da barbearia e URL pública estável em vez de URL assinada temporária.
- A exclusão removerá do armazenamento apenas arquivos personalizados pertencentes à barbearia; imagens padrão do projeto não serão tocadas.
