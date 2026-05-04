import csv
import json
import time
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


BASE_URL = "https://www.comar.tn"
LEXIQUE_URL = "https://www.comar.tn/lexique?body_value=&page=0"
DOCUMENTS_URL = "https://www.comar.tn/documents-utiles"


def create_driver(headless=True):
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1400,1000")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    driver = webdriver.Chrome(options=options)
    return driver


def wait_page_loaded(driver, timeout=15):
    WebDriverWait(driver, timeout).until(
        lambda d: d.execute_script("return document.readyState") == "complete"
    )


def safe_text(element):
    try:
        return element.text.strip()
    except Exception:
        return ""


def scrape_homepage_info(driver):
    driver.get(BASE_URL)
    wait_page_loaded(driver)

    data = {
        "url": BASE_URL,
        "title": driver.title,
        "sections": [],
        "contact_lines": [],
    }

    try:
        headings = driver.find_elements(By.XPATH, "//h1 | //h2 | //h3 | //h4")
        data["sections"] = [safe_text(h) for h in headings if safe_text(h)]
    except Exception:
        pass

    try:
        body_text = driver.find_element(By.TAG_NAME, "body").text
        for line in body_text.splitlines():
            line = line.strip()
            if any(
                keyword in line.lower()
                for keyword in ["service client", "contact@", "avenue habib bourguiba", "tél"]
            ):
                data["contact_lines"].append(line)
    except Exception:
        pass

    return data


def scrape_lexique(driver, max_pages=7):
    results = []

    for page_index in range(max_pages):
        url = f"https://www.comar.tn/lexique?body_value=&page={page_index}"
        driver.get(url)
        wait_page_loaded(driver)

        time.sleep(1)

        # On récupère les liens détaillés du lexique
        term_links = driver.find_elements(
            By.XPATH,
            "//a[contains(@href, '/lexique/') and not(contains(@href, '?'))]"
        )

        seen = set()
        links = []

        for a in term_links:
            href = a.get_attribute("href")
            text = safe_text(a)
            if not href:
                continue
            if href in seen:
                continue
            if href.endswith("/lexique"):
                continue
            seen.add(href)
            links.append((text, href))

        for text, href in links:
            try:
                driver.get(href)
                wait_page_loaded(driver)
                time.sleep(0.5)

                title = ""
                content = ""

                try:
                    h1 = driver.find_element(By.XPATH, "//h1")
                    title = safe_text(h1)
                except Exception:
                    pass

                if not title:
                    title = text

                try:
                    paragraphs = driver.find_elements(By.XPATH, "//main//p | //article//p | //div//p")
                    paragraph_texts = [safe_text(p) for p in paragraphs if safe_text(p)]
                    if paragraph_texts:
                        content = " ".join(paragraph_texts[:3])
                except Exception:
                    pass

                if title or content:
                    results.append(
                        {
                            "type": "lexique",
                            "title": title,
                            "content": content,
                            "url": href,
                        }
                    )
            except Exception as e:
                print(f"Erreur sur {href}: {e}")

    # dédoublonnage
    unique = {}
    for item in results:
        unique[item["url"]] = item

    return list(unique.values())


def scrape_documents_utiles(driver):
    driver.get(DOCUMENTS_URL)
    wait_page_loaded(driver)
    time.sleep(1)

    documents = []

    pdf_links = driver.find_elements(By.XPATH, "//a[contains(@href, '.pdf')]")

    for link in pdf_links:
        pdf_url = link.get_attribute("href")
        pdf_text = safe_text(link)

        title = ""

        try:
            # Chercher un titre proche dans le bloc parent
            container = link.find_element(By.XPATH, "./ancestor::div[1]")
            block_text = safe_text(container)
            lines = [line.strip() for line in block_text.splitlines() if line.strip()]
            if lines:
                title = lines[0]
        except Exception:
            pass

        if not title:
            title = pdf_text

        if pdf_url:
            documents.append(
                {
                    "type": "document",
                    "title": title,
                    "label": pdf_text,
                    "pdf_url": pdf_url,
                    "source_page": DOCUMENTS_URL,
                }
            )

    # dédoublonnage
    unique = {}
    for doc in documents:
        unique[doc["pdf_url"]] = doc

    return list(unique.values())


def save_json(filename, data):
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def save_csv(filename, data):
    if not data:
        return
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)


def main():
    driver = create_driver(headless=True)

    try:
        print("Scraping homepage...")
        homepage = scrape_homepage_info(driver)

        print("Scraping lexique...")
        lexique = scrape_lexique(driver, max_pages=7)

        print("Scraping documents utiles...")
        documents = scrape_documents_utiles(driver)

        all_data = {
            "homepage": homepage,
            "lexique_count": len(lexique),
            "documents_count": len(documents),
            "lexique": lexique,
            "documents": documents,
        }

        save_json("comar_data.json", all_data)
        save_csv("comar_lexique.csv", lexique)
        save_csv("comar_documents.csv", documents)

        print("Terminé ✅")
        print(f"Lexique: {len(lexique)} entrées")
        print(f"Documents: {len(documents)} fichiers")

    finally:
        driver.quit()


if __name__ == "__main__":
    main()