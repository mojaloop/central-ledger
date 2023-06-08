package io.mojaloop.centralledger.jmeter.util;

import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.centralledger.jmeter.rest.client.json.testdata.TestPlanConfig;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Amount;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Transfer;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.stream.Collectors;

public class TestDataUtil {

	public static List<TestDataCarrier> readTestDataFromFile(File testData) {
		if (testData == null) throw new IllegalStateException("Test Data file not set!");
		if (!testData.exists()) throw new IllegalStateException(String.format("Test Data '%s' does not exist.", testData.getAbsolutePath()));

		List<TestDataCarrier> returnVal = new ArrayList<>();

		try (BufferedReader br = new BufferedReader(new FileReader(testData))) {
			String line;
			StringBuffer content = new StringBuffer();
			while ((line = br.readLine()) != null) {
				content.append(line);
				content.append("\n");
			}
			JSONArray array = new JSONArray(content.toString());
			for (int index = 0; index < array.length(); index++) {
				TestDataCarrier toAdd = new TestDataCarrier(array.getJSONObject(index));
				returnVal.add(toAdd);
			}
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to read from '%s'. %s.",
					testData.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}
		return returnVal;
	}

	public static List<TestDataCarrier> filterForType(
		List<TestDataCarrier> source,
		TestDataCarrier.ActionType type
	) {
		return source.stream()
				.filter(itm -> itm.getActionType() == type)
				.collect(Collectors.toList());
	}

	public static TestPlanConfig readTestPlanConfig(File configFile) {
		if (!configFile.exists()) throw new IllegalStateException(String.format("Config '%s' does not exist.", configFile.getAbsolutePath()));

		StringBuffer buffer = new StringBuffer();
		try (FileReader fr = new FileReader(configFile)) {
			int read = -1;
			while ((read = fr.read()) != -1) buffer.append((char)read);
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to read from '%s'. %s.",
					configFile.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}
		String data = buffer.toString();
		return new TestPlanConfig(new JSONObject(data));
	}

	public static void generateTestData(File testPlanConfigPath, File outputFile) {
		generateTestData(readTestPlanConfig(testPlanConfigPath), outputFile);
	}

	public static void generateTestData(TestPlanConfig testPlanConfig, File outputFile) {
		try (FileWriter fw = new FileWriter(outputFile, false)) {
			List<TestDataCarrier> testData = genTestDataFrom(testPlanConfig);
			JSONArray array = new JSONArray();
			testData.forEach(tdItm -> array.put(tdItm.toJsonObject()));
			String content = array.toString(2);
			try {
				fw.write(content);
			} catch (IOException eParam) {
				throw new IllegalStateException(String.format("Unable to write '%s' ", content));
			}
			fw.flush();
		} catch (IOException ioErr) {
			throw new IllegalStateException(String.format(
					"Unable to write to '%s'. %s.",
					outputFile.getAbsolutePath(), ioErr.getMessage()), ioErr);
		}


	}

	private static List<TestDataCarrier> genTestDataFrom(TestPlanConfig testPlanConfig) {
		List<TestDataCarrier> returnVal = new ArrayList<>();

		List<Participant> participants = new ArrayList<>();
		for (int index = 0; index < testPlanConfig.getParticipantAccounts(); index++) {
			TestDataCarrier toAddParticipant = new TestDataCarrier(new JSONObject());
			toAddParticipant.setActionType(TestDataCarrier.ActionType.create_participant);

			Participant participant = new Participant(new JSONObject());
			String name = String.format("fspJM%s", UUID.randomUUID().toString().replace("-",""))
					.substring(0, 30);
			participant.setName(name);
			participant.setCurrency(testPlanConfig.getTransfersCurrency());
			toAddParticipant.setRequest(participant);
			returnVal.add(toAddParticipant);
			participants.add(participant);
		}

		int transferLookupsCreated = 0;
		for (int index = 0; index < testPlanConfig.getTransfers(); index++) {
			TestDataCarrier toAdd = new TestDataCarrier(new JSONObject());

			if (testPlanConfig.isTransferSingleHttpRequest()) {
				toAdd.setActionType(TestDataCarrier.ActionType.transfer_prepare_fulfil);
			} else {
				toAdd.setActionType(TestDataCarrier.ActionType.transfer_prepare);
			}

			Transfer transfer = new Transfer(new JSONObject());
			transfer.setTransferId(UUID.randomUUID().toString());
			transfer.setFulfil(testPlanConfig.isTransferSingleHttpRequest());

			Random random = new Random();
			int payerIndex = -1, payeeIndex = -1;
			do {
				payerIndex = random.nextInt(testPlanConfig.getParticipantAccounts());
				payeeIndex = random.nextInt(testPlanConfig.getParticipantAccounts());
			} while (payeeIndex == payerIndex);

			//transfer.setPayerFsp("payerFsp55863996");
			transfer.setPayerFsp(participants.get(payerIndex).getName());
			//transfer.setPayeeFsp("payeeFsp55864046");
			transfer.setPayeeFsp(participants.get(payeeIndex).getName());
			transfer.setCondition("GRzLaTP7DJ9t4P-a_BA0WA9wzzlsugf00-Tn6kESAfM");
			Amount transAmount = new Amount(new JSONObject());

			long transactionAmount = 0;
			do {
				transactionAmount = Long.valueOf(random.nextInt(200));
			} while (transactionAmount < 1);

			transAmount.setAmount(transactionAmount);
			transAmount.setCurrency(testPlanConfig.getTransfersCurrency());
			transfer.setAmount(transAmount);
			transfer.setIlpPacket("AYIBgQAAAAAAAASwNGxldmVsb25lLmRmc3AxLm1lci45T2RTOF81MDdqUUZERmZlakgyOVc4bXFmNEpLMHlGTFGCAUBQU0svMS4wCk5vbmNlOiB1SXlweUYzY3pYSXBFdzVVc05TYWh3CkVuY3J5cHRpb246IG5vbmUKUGF5bWVudC1JZDogMTMyMzZhM2ItOGZhOC00MTYzLTg0NDctNGMzZWQzZGE5OGE3CgpDb250ZW50LUxlbmd0aDogMTM1CkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vanNvbgpTZW5kZXItSWRlbnRpZmllcjogOTI4MDYzOTEKCiJ7XCJmZWVcIjowLFwidHJhbnNmZXJDb2RlXCI6XCJpbnZvaWNlXCIsXCJkZWJpdE5hbWVcIjpcImFsaWNlIGNvb3BlclwiLFwiY3JlZGl0TmFtZVwiOlwibWVyIGNoYW50XCIsXCJkZWJpdElkZW50aWZpZXJcIjpcIjkyODA2MzkxXCJ9IgA");

			toAdd.setRequest(transfer);
			returnVal.add(toAdd);

			if (index > 5 && (transferLookupsCreated < testPlanConfig.getTransferLookups())) {
				boolean addLookup = new Random().nextInt(2) > 0;
				if (addLookup) {
					TestDataCarrier lookup = new TestDataCarrier(new JSONObject());
					lookup.setActionType(TestDataCarrier.ActionType.transfer_lookup);
					returnVal.add(lookup);
					transferLookupsCreated++;
				}
			}
		}

		while (transferLookupsCreated < testPlanConfig.getTransferLookups()) {
			TestDataCarrier lookup = new TestDataCarrier(new JSONObject());
			lookup.setActionType(TestDataCarrier.ActionType.transfer_lookup);
			returnVal.add(lookup);
			transferLookupsCreated++;
		}

		return returnVal;
	}
}
