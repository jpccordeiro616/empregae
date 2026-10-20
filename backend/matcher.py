from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# Palavras muito comuns que não ajudam a diferenciar perfis e vagas (sem acento,
# pois os textos têm os acentos removidos antes da comparação).
STOPWORDS_PT = """
a ao aos as ate com como da das de dela dele do dos e ela ele em entre era essa esse esta este eu
foi ha isso isto ja la lhe mais mas me meu minha muito na nao nas nem no nos nossa nosso num numa
o os ou para pela pelas pelo pelos por qual quando que quem se sem ser seu sua sao so tambem te tem
ter um uma umas uns voce voces gosto gostaria quero busco procuro estou sou tenho anos vaga vagas
""".split()

def calcular_compatibilidades(texto_base: str, textos: list[str]) -> list[float]:
    """Compara um texto com vários outros e devolve a compatibilidade (0 a 100) de cada um.

    Usa TF-IDF calculado sobre o conjunto inteiro, para que palavras que aparecem
    em todas as vagas (ou todos os perfis) pesem menos que as específicas.
    """
    if not texto_base or not textos:
        return [0.0] * len(textos)

    vetorizador = TfidfVectorizer(strip_accents="unicode", stop_words=STOPWORDS_PT)
    try:
        matriz = vetorizador.fit_transform([texto_base, *(t or "" for t in textos)])
    except ValueError:  # nenhum termo útil nos textos
        return [0.0] * len(textos)

    similaridades = cosine_similarity(matriz[0:1], matriz[1:]).ravel()
    return [round(float(s) * 100, 2) for s in similaridades]
