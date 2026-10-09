from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

def calcular_compatibilidade(descricao_jovem: str, descricao_vaga: str) -> float:
    if not descricao_jovem or not descricao_vaga:
        return 0.0

    vetorizador = TfidfVectorizer()
    try:
        matriz_tfidf = vetorizador.fit_transform([descricao_jovem, descricao_vaga])
        similaridade = cosine_similarity(matriz_tfidf[0:1], matriz_tfidf[1:2])[0][0]
        return round(float(similaridade) * 100, 2)
    except Exception:
        return 0.0
